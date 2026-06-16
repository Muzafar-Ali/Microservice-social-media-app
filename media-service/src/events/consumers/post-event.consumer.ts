import { Consumer, Producer } from 'kafkajs';
import MediaService from '../../services/media.service.js';
import { FailedMessageContext } from '../../types/media-event-consumer.types.js';
import { postDeletedEventSchema, PostDeletedEvent } from '../../validations/media.validation.js';
import formatZodError from '../../utils/formatZodError.js';
import logger from '../../utils/logger.js';
import { KAFKA_TOPICS, POST_EVENT_NAMES } from '../topics.js';
import {
  kafkaConsumerFailuresTotal,
  kafkaDlqMessagesTotal,
  kafkaMessagesConsumedTotal,
  kafkaOffsetCommitFailuresTotal,
} from '../../monitoring/kafka.metrics.js';
import { mediaCleanupEventsProcessedTotal } from '../../monitoring/media.metrics.js';

class PostEventConsumer {
  private readonly maxProcessingAttempts = 3;
  private readonly retryBaseDelayMs = 500;

  constructor(
    private readonly consumer: Consumer,
    private readonly dlqProducer: Producer,
    private readonly mediaService: MediaService,
  ) {}

  public async start(): Promise<void> {
    await this.consumer.subscribe({
      topic: KAFKA_TOPICS.POST_EVENTS,
      fromBeginning: false,
    });

    await this.consumer.run({
      autoCommit: false,
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) {
          kafkaConsumerFailuresTotal.inc({ topic, reason: 'empty_message' });
          logger.warn({ topic, partition, offset: message.offset }, 'Received empty post event');

          await this.sendToDlq({
            topic,
            partition,
            offset: message.offset,
            rawValue: '',
            reason: 'Empty Kafka message value',
          });
          await this.commitNextOffset(topic, partition, message.offset);
          return;
        }

        const rawValue = message.value.toString();
        let parsedJson: { eventName?: string };

        try {
          parsedJson = JSON.parse(rawValue) as { eventName?: string };
        } catch (error) {
          kafkaConsumerFailuresTotal.inc({ topic, reason: 'invalid_json' });
          logger.error(
            { error, topic, partition, offset: message.offset, rawValue },
            'Received invalid JSON post event in media-service',
          );

          await this.sendToDlq({
            topic,
            partition,
            offset: message.offset,
            rawValue,
            reason: 'Invalid JSON message value',
          });
          await this.commitNextOffset(topic, partition, message.offset);
          return;
        }

        switch (parsedJson.eventName) {
          case POST_EVENT_NAMES.POST_DELETED: {
            kafkaMessagesConsumedTotal.inc({ topic, event_name: POST_EVENT_NAMES.POST_DELETED });
            const safeEvent = postDeletedEventSchema.safeParse(parsedJson);

            if (!safeEvent.success) {
              kafkaConsumerFailuresTotal.inc({ topic, reason: 'invalid_post_deleted_schema' });
              logger.error(formatZodError(safeEvent.error));

              await this.sendToDlq({
                topic,
                partition,
                offset: message.offset,
                rawValue,
                reason: 'Invalid post.deleted schema',
              });
              await this.commitNextOffset(topic, partition, message.offset);
              return;
            }

            await this.processWithRetry(() => this.handlePostDeleted(safeEvent.data), {
              topic,
              partition,
              offset: message.offset,
              rawValue,
              reason: 'Retry exhausted while processing post.deleted',
            });
            await this.commitNextOffset(topic, partition, message.offset);
            return;
          }

          default:
            kafkaMessagesConsumedTotal.inc({ topic, event_name: parsedJson.eventName ?? 'unknown' });
            logger.debug(
              { topic, partition, offset: message.offset, eventName: parsedJson.eventName },
              'Ignoring post event in media-service',
            );
            await this.commitNextOffset(topic, partition, message.offset);
        }
      },
    });
  }

  private async handlePostDeleted(event: PostDeletedEvent): Promise<void> {
    try {
      await this.mediaService.cleanupPostMediaFromDeletedPost(event.eventId, event.data.media);
      mediaCleanupEventsProcessedTotal.inc({ result: 'success' });
    } catch (error) {
      mediaCleanupEventsProcessedTotal.inc({ result: 'failure' });
      throw error;
    }

    logger.info(
      {
        eventId: event.eventId,
        postId: event.data.postId,
        mediaCount: event.data.media.length,
      },
      'Cleaned up media for deleted post',
    );
  }

  private async processWithRetry(operation: () => Promise<void>, context: FailedMessageContext): Promise<void> {
    for (let attempt = 1; attempt <= this.maxProcessingAttempts; attempt++) {
      try {
        await operation();
        return;
      } catch (error) {
        kafkaConsumerFailuresTotal.inc({ topic: context.topic, reason: context.reason });
        logger.warn(
          { error, attempt, maxAttempts: this.maxProcessingAttempts, ...context },
          'Post event processing attempt failed in media-service',
        );

        if (attempt === this.maxProcessingAttempts) {
          logger.error({ error, ...context }, 'Post event retries exhausted in media-service');
          await this.sendToDlq(context);
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, this.retryBaseDelayMs * attempt));
      }
    }
  }

  private async commitNextOffset(topic: string, partition: number, currentOffset: string): Promise<void> {
    const nextOffset = (BigInt(currentOffset) + BigInt(1)).toString();

    try {
      await this.consumer.commitOffsets([
        {
          topic,
          partition,
          offset: nextOffset,
        },
      ]);
    } catch (error) {
      kafkaOffsetCommitFailuresTotal.inc({ topic });
      logger.error({ error, topic, partition, nextOffset }, 'Failed to commit post Kafka offset in media-service');
      throw error;
    }
  }

  private async sendToDlq(context: FailedMessageContext): Promise<void> {
    await this.dlqProducer.send({
      topic: KAFKA_TOPICS.MEDIA_SERVICE_POST_EVENTS_DLQ,
      acks: -1,
      messages: [
        {
          key: `${context.topic}:${context.partition}:${context.offset}`,
          value: JSON.stringify({
            failedAt: new Date().toISOString(),
            sourceTopic: context.topic,
            sourcePartition: context.partition,
            sourceOffset: context.offset,
            rawValue: context.rawValue,
            reason: context.reason,
            consumerService: 'media-service',
            consumerGroup: 'media-service-post-events',
          }),
        },
      ],
    });

    kafkaDlqMessagesTotal.inc({
      source_topic: context.topic,
      dlq_topic: KAFKA_TOPICS.MEDIA_SERVICE_POST_EVENTS_DLQ,
      reason: context.reason,
    });

    logger.error(context, 'Sent post event to media-service DLQ');
  }
}

export default PostEventConsumer;
