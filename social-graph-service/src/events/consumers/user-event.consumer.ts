import { Consumer, Producer } from 'kafkajs';
import { SocialGraphService } from '../../services/socialGraph.service.js';
import { KAFKA_TOPICS, USER_EVENT_NAMES } from '../socialGraph-event.topics.js';
import logger from '../../utils/logger.js';
import {
  UserCreatedEvent,
  userCreatedEventSchema,
  UserUpdatedEvent,
  userUpdatedEventSchema,
} from '../../validations/socialGraph.validation.js';
import formatZodError from '../../utils/formatZodError.js';
import { FailedMessageContext } from '../../types/social-graph-common.types.js';
import {
  kafkaConsumerFailuresTotal,
  kafkaDlqMessagesTotal,
  kafkaMessagesConsumedTotal,
  kafkaOffsetCommitFailuresTotal,
} from '../../monitoring/kafka.metrics.js';

class UserEventConsumer {
  private readonly maxProcessingAttempts = 3;
  private readonly retryBaseDelayMs = 500;

  constructor(
    private readonly consumer: Consumer,
    private readonly dlqProducer: Producer,
    private readonly socialGraphService: SocialGraphService,
  ) {}

  public async start(): Promise<void> {
    await this.consumer.subscribe({
      topic: KAFKA_TOPICS.USER_EVENTS,
      fromBeginning: false,
    });

    await this.consumer.run({
      autoCommit: false,
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) {
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
            { error, topic, partition, offset: message.offset, rawValue },
            'Received invalid JSON Kafka message in social-graph-service',
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
          case USER_EVENT_NAMES.USER_CREATED: {
            kafkaMessagesConsumedTotal.inc({ topic, event_name: USER_EVENT_NAMES.USER_CREATED });
            const safeEvent = userCreatedEventSchema.safeParse(parsedJson);

            if (!safeEvent.success) {
              kafkaConsumerFailuresTotal.inc({ topic, reason: 'invalid_user_created_schema' });
              logger.error(formatZodError(safeEvent.error));

              await this.sendToDlq({
                topic,
                partition,
                offset: message.offset,
                rawValue,
                reason: 'Invalid user.created schema',
              });

              await this.commitNextOffset(topic, partition, message.offset);
              return;
            }

            await this.processEventWithRetry(() => this.handleUserCreated(safeEvent.data), {
              topic,
              partition,
              offset: message.offset,
              rawValue,
              reason: 'Retry exhausted while processing user.created',
            });

            await this.commitNextOffset(topic, partition, message.offset);
            return;
          }

          case USER_EVENT_NAMES.USER_UPDATED: {
            kafkaMessagesConsumedTotal.inc({ topic, event_name: USER_EVENT_NAMES.USER_UPDATED });
            const safeEvent = userUpdatedEventSchema.safeParse(parsedJson);

            if (!safeEvent.success) {
              kafkaConsumerFailuresTotal.inc({ topic, reason: 'invalid_user_updated_schema' });
              logger.error(formatZodError(safeEvent.error));

              await this.sendToDlq({
                topic,
                partition,
                offset: message.offset,
                rawValue,
                reason: 'Invalid user.updated schema',
              });

              await this.commitNextOffset(topic, partition, message.offset);
              return;
            }

            await this.processEventWithRetry(() => this.handleUserUpdated(safeEvent.data), {
              topic,
              partition,
              offset: message.offset,
              rawValue,
              reason: 'Retry exhausted while processing user.updated',
            });
            await this.commitNextOffset(topic, partition, message.offset);
            return;
          }

          default: {
            kafkaMessagesConsumedTotal.inc({ topic, event_name: parsedJson.eventName ?? 'unknown' });

            logger.warn(
              {
                topic,
                partition,
                offset: message.offset,
                eventName: parsedJson.eventName,
              },
              'Ignoring unknown user event in social-graph-service',
            );

            await this.commitNextOffset(topic, partition, message.offset);
            return;
          }
        }
      },
    });
  }

  private async handleUserCreated(event: UserCreatedEvent): Promise<void> {
    const data = event.data;

    logger.info(
      {
        eventName: event.eventName,
        eventId: event.eventId,
        userId: data.userId,
        username: data.username,
      },
      'Handling user.created event in social-graph-service',
    );

    const wasProcessed = await this.socialGraphService.applyUserProfileEvent({
      eventId: event.eventId,
      userId: data.userId,
      username: data.username,
      displayName: data.displayName ?? null,
      avatarUrl: data.profileImage?.secureUrl ?? null,
      status: data.status,
      isPrivate: data.isPrivate,
    });

    if (!wasProcessed) {
      logger.info({ eventId: event.eventId }, 'Skipped duplicate user.created event');
    }
  }

  private async handleUserUpdated(event: UserUpdatedEvent): Promise<void> {
    const data = event.data;

    logger.info(
      {
        eventName: event.eventName,
        eventId: event.eventId,
        userId: data.userId,
        username: data.username,
      },
      'Handling user.updated event in social-graph-service',
    );

    const wasProcessed = await this.socialGraphService.applyUserProfileEvent({
      eventId: event.eventId,
      userId: data.userId,
      username: data.username,
      displayName: data.displayName,
      avatarUrl: data.profileImage?.secureUrl ?? null,
      status: data.status,
      isPrivate: data.isPrivate,
    });

    if (!wasProcessed) {
      logger.info({ eventId: event.eventId }, 'Skipped duplicate user.updated event');
    }
  }

  private async processEventWithRetry(operation: () => Promise<void>, context: FailedMessageContext): Promise<void> {
    for (let attempt = 1; attempt <= this.maxProcessingAttempts; attempt++) {
      try {
        await operation();
        return;
      } catch (error) {
        kafkaConsumerFailuresTotal.inc({ topic: context.topic, reason: context.reason });

        logger.warn(
          { error, attempt, maxAttempts: this.maxProcessingAttempts, ...context },
          'User event processing attempt failed in social-graph-service',
        );

        if (attempt === this.maxProcessingAttempts) {
          logger.error({ error, ...context }, 'User event processing retries exhausted in social-graph-service');

          await this.sendToDlq(context);
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, this.retryBaseDelayMs * attempt));
      }
    }
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
    } catch (error) {
      kafkaOffsetCommitFailuresTotal.inc({ topic });
      logger.error({ error, topic, partition, nextOffset }, 'Failed to commit user Kafka offset');
      throw error;
    }

    logger.info(
      {
        topic,
        partition,
        committedOffset: nextOffset,
      },
      'Committed user Kafka offset in social-graph-service',
    );
  }

  private async sendToDlq(context: FailedMessageContext): Promise<void> {
    await this.dlqProducer.send({
      topic: KAFKA_TOPICS.USER_EVENTS_DLQ,
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
            consumerService: 'social-graph-service',
            consumerGroup: 'social-graph-service-user-events',
          }),
        },
      ],
    });

    kafkaDlqMessagesTotal.inc({
      source_topic: context.topic,
      dlq_topic: KAFKA_TOPICS.USER_EVENTS_DLQ,
      reason: context.reason,
    });

    logger.error(context, 'Sent user event to DLQ from social-graph-service');
  }
}

export default UserEventConsumer;
