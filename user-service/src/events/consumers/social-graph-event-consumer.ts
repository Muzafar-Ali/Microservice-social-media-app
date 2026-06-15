import { Consumer, Producer } from 'kafkajs';
import { UserService } from '../../modules/user/user.service.js';
import { KAFKA_TOPICS, SOCIAL_GRAPH_EVENT_NAMES } from '../topics.js';
import logger from '../../utils/logger.js';
import {
  FollowCreatedEvent,
  followCreatedEventSchema,
  FollowRemovedEvent,
  followRemovedEventSchema,
} from '../../modules/user/user.validations.js';
import formatZodError from '../../utils/formatZodError.js';
import { FailedMessageContext } from '../../types/common.types.js';
import {
  kafkaConsumerFailuresTotal,
  kafkaDlqMessagesTotal,
  kafkaMessagesConsumedTotal,
  kafkaOffsetCommitFailuresTotal,
} from '../../monitoring/kafka.metrics.js';

export class SocialGraphEventConsumer {
  private readonly maxProcessingAttempts = 3;
  private readonly retryBaseDelayMs = 500;

  constructor(
    private readonly consumer: Consumer,
    private readonly dlqProducer: Producer,
    private readonly userService: UserService,
  ) {}

  public async start() {
    await this.consumer.subscribe({
      topic: KAFKA_TOPICS.SOCIAL_GRAPH_EVENTS,
      fromBeginning: false,
    });

    await this.consumer.run({
      autoCommit: false,
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) {
          kafkaMessagesConsumedTotal.inc({ topic, event_name: 'unknown' });
          kafkaConsumerFailuresTotal.inc({ topic, reason: 'empty_message' });
          logger.warn({ topic, partition, offset: message.offset }, 'Received empty Kafka message');

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
            {
              error,
              topic,
              partition,
              offset: message.offset,
              rawValue,
            },
            'Received invalid JSON Kafka message in user-service',
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

        kafkaMessagesConsumedTotal.inc({ topic, event_name: parsedJson.eventName || 'unknown' });

        switch (parsedJson.eventName) {
          case SOCIAL_GRAPH_EVENT_NAMES.FOLLOW_CREATED:
          case SOCIAL_GRAPH_EVENT_NAMES.FOLLOW_ACCEPTED: {
            const safeEvent = followCreatedEventSchema.safeParse(parsedJson);

            if (!safeEvent.success) {
              kafkaConsumerFailuresTotal.inc({ topic, reason: 'invalid_follow_activated_schema' });
              logger.error(formatZodError(safeEvent.error));

              await this.sendToDlq({
                topic,
                partition,
                offset: message.offset,
                rawValue,
                reason: `Invalid ${parsedJson.eventName} schema`,
              });

              await this.commitNextOffset(topic, partition, message.offset);
              return;
            }

            try {
              await this.processWithRetry(() => this.handleFollowCreated(safeEvent.data), {
                topic,
                partition,
                offset: message.offset,
                eventName: safeEvent.data.eventName,
                eventId: safeEvent.data.eventId,
              });
            } catch (error) {
              await this.handleRetryExhausted({
                error,
                topic,
                partition,
                offset: message.offset,
                rawValue,
                reason: `Retry exhausted while processing ${safeEvent.data.eventName}`,
              });
            }

            await this.commitNextOffset(topic, partition, message.offset);
            return;
          }

          case SOCIAL_GRAPH_EVENT_NAMES.FOLLOW_REMOVED: {
            const safeEvent = followRemovedEventSchema.safeParse(parsedJson);

            if (!safeEvent.success) {
              kafkaConsumerFailuresTotal.inc({ topic, reason: 'invalid_follow_removed_schema' });
              logger.error(formatZodError(safeEvent.error));

              await this.sendToDlq({
                topic,
                partition,
                offset: message.offset,
                rawValue,
                reason: 'Invalid follow.removed schema',
              });

              await this.commitNextOffset(topic, partition, message.offset);
              return;
            }

            try {
              await this.processWithRetry(() => this.handleFollowRemoved(safeEvent.data), {
                topic,
                partition,
                offset: message.offset,
                eventName: safeEvent.data.eventName,
                eventId: safeEvent.data.eventId,
              });
            } catch (error) {
              await this.handleRetryExhausted({
                error,
                topic,
                partition,
                offset: message.offset,
                rawValue,
                reason: 'Retry exhausted while processing follow.removed',
              });
            }

            await this.commitNextOffset(topic, partition, message.offset);
            return;
          }

          default: {
            kafkaConsumerFailuresTotal.inc({ topic, reason: 'unknown_event' });

            logger.warn(
              {
                topic,
                partition,
                offset: message.offset,
                eventName: parsedJson.eventName,
              },
              'Ignoring unknown user event in user-service',
            );

            await this.commitNextOffset(topic, partition, message.offset);
            return;
          }
        }
      },
    });
  }

  private async handleFollowCreated(event: FollowCreatedEvent): Promise<void> {
    const data = event.data;

    logger.debug(
      {
        eventName: event.eventName,
        eventId: event.eventId,
        followerId: data.followerId,
        followeeId: data.followeeId,
      },
      'Handling active follow event in user-service',
    );

    await this.userService.followCreated({
      eventId: event.eventId,
      followerId: data.followerId,
      followeeId: data.followeeId,
    });
  }

  private async handleFollowRemoved(event: FollowRemovedEvent): Promise<void> {
    const data = event.data;

    logger.debug(
      {
        eventName: event.eventName,
        eventId: event.eventId,
        followerId: data.followerId,
        followeeId: data.followeeId,
      },
      'Handling follow.removed event in user-service',
    );

    await this.userService.followRemoved({
      eventId: event.eventId,
      followerId: data.followerId,
      followeeId: data.followeeId,
    });
  }

  private async processWithRetry(
    operation: () => Promise<void>,
    context: {
      topic: string;
      partition: number;
      offset: string;
      eventName: string;
      eventId: string;
    },
  ): Promise<void> {
    for (let attempt = 1; attempt <= this.maxProcessingAttempts; attempt++) {
      try {
        await operation();
        return;
      } catch (error) {
        kafkaConsumerFailuresTotal.inc({ topic: context.topic, reason: 'processing_retry' });

        logger.warn(
          {
            error,
            attempt,
            maxAttempts: this.maxProcessingAttempts,
            ...context,
          },
          'Kafka event processing attempt failed in user-service',
        );

        if (attempt === this.maxProcessingAttempts) {
          throw error;
        }

        await this.sleep(this.retryBaseDelayMs * attempt);
      }
    }
  }

  private async handleRetryExhausted(context: FailedMessageContext & { error: unknown }): Promise<void> {
    kafkaConsumerFailuresTotal.inc({ topic: context.topic, reason: 'processing_retry_exhausted' });

    logger.error(
      {
        error: context.error,
        topic: context.topic,
        partition: context.partition,
        offset: context.offset,
        rawValue: context.rawValue,
      },
      'Kafka event processing retries exhausted in user-service',
    );

    await this.sendToDlq(context);
  }

  private async sleep(delayMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  private async commitNextOffset(topic: string, partition: number, currentOffset: string): Promise<void> {
    const nextOffset = (BigInt(currentOffset) + 1n).toString();

    try {
      await this.consumer.commitOffsets([
        {
          topic,
          partition,
          offset: nextOffset,
        },
      ]);

      logger.debug(
        {
          topic,
          partition,
          committedOffset: nextOffset,
        },
        'Committed user Kafka offset in social-graph-service',
      );
    } catch (error) {
      kafkaOffsetCommitFailuresTotal.inc({ topic });
      logger.error({ error, topic, partition, nextOffset }, 'Failed to commit user Kafka offset');
      throw error;
    }
  }

  private async sendToDlq(context: FailedMessageContext): Promise<void> {
    await this.dlqProducer.send({
      topic: KAFKA_TOPICS.SOCIAL_GRAPH_EVENTS_DLQ,
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
            consumerService: 'user-service',
            consumerGroup: 'user-service-social-graph-events',
          }),
        },
      ],
    });

    kafkaDlqMessagesTotal.inc({
      source_topic: context.topic,
      dlq_topic: KAFKA_TOPICS.SOCIAL_GRAPH_EVENTS_DLQ,
      reason: context.reason,
    });

    logger.error(context, 'Sent social graph event to DLQ from user-service');
  }
}
