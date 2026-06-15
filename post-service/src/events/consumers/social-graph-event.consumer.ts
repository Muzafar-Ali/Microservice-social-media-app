import { Consumer, Producer } from 'kafkajs';
import { PostService } from '../../services/post.service.js';
import { FailedMessageContext } from '../../types/post-event-consumer.types..js';
import formatZodError from '../../utils/formatZodError.js';
import logger from '../../utils/logger.js';
import {
  ActiveFollowCreatedEvent,
  activeFollowCreatedEventSchema,
  ActiveFollowRemovedEvent,
  activeFollowRemovedEventSchema,
} from '../../validation/post.validation.js';
import { KAFKA_TOPICS, SOCIAL_GRAPH_EVENT_NAMES } from '../topics.js';

class SocialGraphEventConsumer {
  private readonly maxProcessingAttempts = 3;
  private readonly retryBaseDelayMs = 500;

  constructor(
    private readonly consumer: Consumer,
    private readonly dlqProducer: Producer,
    private readonly postService: PostService,
  ) {}

  public async start(): Promise<void> {
    await this.consumer.subscribe({
      topic: KAFKA_TOPICS.SOCIAL_GRAPH_EVENTS,
      fromBeginning: false,
    });

    await this.consumer.run({
      autoCommit: false,
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) {
          logger.warn({ topic, partition, offset: message.offset }, 'Received empty social graph message');
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
          logger.error(
            { error, topic, partition, offset: message.offset, rawValue },
            'Received invalid JSON social graph event in post-service',
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
          case SOCIAL_GRAPH_EVENT_NAMES.FOLLOW_CREATED:
          case SOCIAL_GRAPH_EVENT_NAMES.FOLLOW_ACCEPTED: {
            const safeEvent = activeFollowCreatedEventSchema.safeParse(parsedJson);

            if (!safeEvent.success) {
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

            await this.processWithRetry(() => this.handleFollowActivated(safeEvent.data), {
              topic,
              partition,
              offset: message.offset,
              rawValue,
              reason: `Retry exhausted while processing ${safeEvent.data.eventName}`,
            });
            await this.commitNextOffset(topic, partition, message.offset);
            return;
          }

          case SOCIAL_GRAPH_EVENT_NAMES.FOLLOW_REMOVED: {
            const safeEvent = activeFollowRemovedEventSchema.safeParse(parsedJson);

            if (!safeEvent.success) {
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

            await this.processWithRetry(() => this.handleFollowRemoved(safeEvent.data), {
              topic,
              partition,
              offset: message.offset,
              rawValue,
              reason: 'Retry exhausted while processing follow.removed',
            });
            await this.commitNextOffset(topic, partition, message.offset);
            return;
          }

          case SOCIAL_GRAPH_EVENT_NAMES.FOLLOW_REQUESTED:
            logger.debug(
              { topic, partition, offset: message.offset },
              'Ignoring pending follow request in active-follow projection',
            );
            await this.commitNextOffset(topic, partition, message.offset);
            return;

          default:
            logger.warn(
              { topic, partition, offset: message.offset, eventName: parsedJson.eventName },
              'Ignoring unknown social graph event in post-service',
            );
            await this.commitNextOffset(topic, partition, message.offset);
        }
      },
    });
  }

  private async handleFollowActivated(event: ActiveFollowCreatedEvent): Promise<void> {
    const wasProcessed = await this.postService.applyActiveFollowEvent({
      eventId: event.eventId,
      eventName: event.eventName,
      followerId: event.data.followerId,
      followeeId: event.data.followeeId,
      occurredAt: new Date(event.occurredAt),
    });

    if (!wasProcessed) {
      logger.info({ eventId: event.eventId }, 'Skipped duplicate active follow event');
    }
  }

  private async handleFollowRemoved(event: ActiveFollowRemovedEvent): Promise<void> {
    const wasProcessed = await this.postService.applyActiveFollowEvent({
      eventId: event.eventId,
      eventName: event.eventName,
      followerId: event.data.followerId,
      followeeId: event.data.followeeId,
      occurredAt: new Date(event.occurredAt),
    });

    if (!wasProcessed) {
      logger.info({ eventId: event.eventId }, 'Skipped duplicate follow.removed event');
    }
  }

  private async processWithRetry(operation: () => Promise<void>, context: FailedMessageContext): Promise<void> {
    for (let attempt = 1; attempt <= this.maxProcessingAttempts; attempt++) {
      try {
        await operation();
        return;
      } catch (error) {
        logger.warn(
          { error, attempt, maxAttempts: this.maxProcessingAttempts, ...context },
          'Social graph event processing attempt failed in post-service',
        );

        if (attempt === this.maxProcessingAttempts) {
          logger.error({ error, ...context }, 'Social graph event retries exhausted in post-service');
          await this.sendToDlq(context);
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, this.retryBaseDelayMs * attempt));
      }
    }
  }

  private async commitNextOffset(topic: string, partition: number, currentOffset: string): Promise<void> {
    await this.consumer.commitOffsets([
      {
        topic,
        partition,
        offset: (BigInt(currentOffset) + 1n).toString(),
      },
    ]);
  }

  private async sendToDlq(context: FailedMessageContext): Promise<void> {
    await this.dlqProducer.send({
      topic: KAFKA_TOPICS.POST_SERVICE_SOCIAL_GRAPH_EVENTS_DLQ,
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
            consumerService: 'post-service',
            consumerGroup: 'post-service-social-graph-events',
          }),
        },
      ],
    });

    logger.error(context, 'Sent social graph event to post-service DLQ');
  }
}

export default SocialGraphEventConsumer;
