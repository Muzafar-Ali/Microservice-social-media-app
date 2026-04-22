import { Consumer, Producer } from "kafkajs";
import { PostService } from "../../services/post.service.js";
import { KAFKA_TOPICS, USER_EVENT_NAMES } from "../topics.js";
import logger from "../../utils/logger.js";
import {
  userCreatedEventSchema,
  UserUpdatedEvent,
  userUpdatedEventSchema,
  type UserCreatedEvent,
} from "../../validation/post.validation.js";
import { FailedMessageContext } from "../../types/post-event-consumer.types..js";
import formatZodError from "../../utils/formatZodError.js";

class UserEventConsumer {
  constructor(
    private readonly consumer: Consumer,
    private readonly dlqProducer: Producer,
    private readonly postService: PostService
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
          logger.warn(
            { topic, partition, offset: message.offset },
            "Received empty Kafka message"
          );

          await this.commitNextOffset(topic, partition, message.offset);
          return;
        }

        const rawValue = message.value.toString();

        try {
          const parsedJson = JSON.parse(rawValue);

          switch (parsedJson.eventName) {
            case USER_EVENT_NAMES.USER_CREATED: {
              const safeEvent = userCreatedEventSchema.safeParse(parsedJson);

              if (!safeEvent.success) {
                logger.error(formatZodError(safeEvent.error));

                await this.sendToDlq({
                  topic,
                  partition,
                  offset: message.offset,
                  rawValue,
                  reason: "Invalid user.created schema",
                });

                await this.commitNextOffset(topic, partition, message.offset);
                return;
              }

              await this.handleUserCreated(safeEvent.data);
              await this.commitNextOffset(topic, partition, message.offset);
              return;
            }

            case USER_EVENT_NAMES.USER_UPDATED: {
              const safeEvent = userUpdatedEventSchema.safeParse(parsedJson);

              if (!safeEvent.success) {
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

              await this.handleUserUpdated(safeEvent.data);
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
                "Ignoring unknown user event"
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
            "Failed to process user Kafka message"
          );

          await this.sendToDlq({
            topic,
            partition,
            offset: message.offset,
            rawValue,
            reason: "Unhandled processing error",
          });

          await this.commitNextOffset(topic, partition, message.offset);
        }
      },
    });
  }

  private async handleUserCreated(event: UserCreatedEvent): Promise<void> {
    const data = event.data;

    logger.info(
      {
        eventName: event.eventName,
        userId: data.userId,
        username: data.username,
        eventId: event.eventId,
      },
      "Handling user.created event in post-service"
    );

    await this.postService.upsertUserProfileCache({
      userId: data.userId,
      username: data.username,
      displayName: data.displayName ?? null,
      avatarUrl: data.avatarUrl?.secureUrl ?? null,
      status: data.status,
    });
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
        "Handling user.updated event in post-service"
        );

      await this.postService.upsertUserProfileCache({
        userId: data.userId,
        username: data.username,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl?.secureUrl ?? null,
        status: data.status,
      });
    }

  private async commitNextOffset(
    topic: string,
    partition: number,
    currentOffset: string
  ): Promise<void> {
    const nextOffset = (BigInt(currentOffset) + 1n).toString();

    await this.consumer.commitOffsets([
      {
        topic,
        partition,
        offset: nextOffset,
      },
    ]);

    logger.info(
      { topic, partition, committedOffset: nextOffset },
      "Committed user Kafka offset"
    );
  }

  private async sendToDlq(context: FailedMessageContext): Promise<void> {
    await this.dlqProducer.send({
      topic: KAFKA_TOPICS.POST_SERVICE_USER_EVENTS_DLQ,
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
            consumerService: "post-service",
            consumerGroup: "post-service-user-events",
          }),
        },
      ],
    });

    logger.error(context, "Sent user event to DLQ");
  }
}

export default UserEventConsumer;