// import { Consumer, Producer } from "kafkajs";
// import { SocialGraphService } from "../../services/social-graph.service.js";
// import { KAFKA_TOPICS, USER_EVENT_NAMES } from "../topics.js";
// import logger from "../../utils/logger.js";
// import {
//   userCreatedEventSchema,
//   type UserCreatedEvent,
// } from "../../validation/user-event.validation.js";

import { Consumer, Producer } from 'kafkajs';
import { SocialGraphService } from '../../services/socialGraph.service.js';
import { KAFKA_TOPICS, USER_EVENT_NAMES } from '../socialGraph-event.topics.js';
import logger from '../../utils/logger.js';
import { UserCreatedEvent, userCreatedEventSchema } from '../../validations/socialGraph.validation.js';

type FailedMessageContext = {
  topic: string;
  partition: number;
  offset: string;
  rawValue: string;
  reason: string;
};

class UserEventConsumer {
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
          logger.warn({ topic, partition, offset: message.offset }, 'Received empty Kafka message');

          await this.commitNextOffset(topic, partition, message.offset);
          return;
        }

        const rawValue = message.value.toString();

        try {
          const parsedJson = JSON.parse(rawValue);

          switch (parsedJson.eventName) {
            case USER_EVENT_NAMES.USER_CREATED: {
              const parsedEvent = userCreatedEventSchema.safeParse(parsedJson);

              if (!parsedEvent.success) {
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

              await this.handleUserCreated(parsedEvent.data);
              await this.commitNextOffset(topic, partition, message.offset);
              return;
            }

            default: {
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
        } catch (error) {
          logger.error(
            {
              error,
              topic,
              partition,
              offset: message.offset,
              rawValue,
            },
            'Failed to process user Kafka message in social-graph-service',
          );

          // No offset commit here.
          // Kafka will redeliver from the last committed offset for this group.
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

    await this.socialGraphService.upsertUserProfileCache({
      userId: data.userId,
      username: data.username,
      displayName: data.displayName ?? null,
      avatarUrl: data.avatarUrl?.secureUrl ?? null,
      status: data.status,
    });
  }

  private async commitNextOffset(topic: string, partition: number, currentOffset: string): Promise<void> {
    const nextOffset = (BigInt(currentOffset) + 1n).toString();

    await this.consumer.commitOffsets([
      {
        topic,
        partition,
        offset: nextOffset,
      },
    ]);

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

    logger.error(context, 'Sent user event to DLQ from social-graph-service');
  }
}

export default UserEventConsumer;
