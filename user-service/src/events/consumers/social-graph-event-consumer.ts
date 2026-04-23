import { Consumer, Producer } from "kafkajs";
import { UserService } from "../../modules/user/user.service.js";
import { KAFKA_TOPICS, SOCIAL_GRAPH_EVENT_NAMES } from "../topics.js";
import logger from "../../utils/logger.js";
import { FollowCreatedEvent, followCreatedEventSchema, FollowRemovedEvent, followRemovedEventSchema } from "../../modules/user/user.validations.js";
import formatZodError from "../../utils/formatZodError.js";
import { FailedMessageContext } from "../../types/common.types.js";

export class SocialGrapsEventConsumer {
  constructor(
    private readonly consumer: Consumer,
    private readonly dlqProducer: Producer,
    private readonly userService: UserService
  ){}

  public async start() {

    await this.consumer.subscribe({
      topic: KAFKA_TOPICS.SOCIAL_GRAPH_EVENTS,
      fromBeginning: false
    });

    await this.consumer.run({
      autoCommit: false,
      eachMessage: async({topic, partition, message}) => {
        if (!message.value) {
          logger.warn({ topic, partition, offset: message.offset }, 'Received empty Kafka message');

          await this.commitNextOffset(topic, partition, message.offset);
          return;
        }

        const rawValue = message.value.toString();

        try {
          const parsedJson = JSON.parse(rawValue);

          switch (parsedJson.eventName) {
            case SOCIAL_GRAPH_EVENT_NAMES.FOLLOW_CREATED: {
              const safeEvent = followCreatedEventSchema.safeParse(parsedJson);

              if (!safeEvent.success) {
                logger.error(formatZodError(safeEvent.error));

                await this.sendToDlq({
                  topic,
                  partition,
                  offset: message.offset,
                  rawValue,
                  reason: 'Invalid follow.created schema',
                });

                await this.commitNextOffset(topic, partition, message.offset);
                return;
              }

              await this.handleFollowCreated(safeEvent.data);
              await this.commitNextOffset(topic, partition, message.offset);
              return;
            }

            case SOCIAL_GRAPH_EVENT_NAMES.FOLLOW_REMOVED: {
              const safeEvent = followRemovedEventSchema.safeParse(parsedJson);

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

              await this.handleFollowRemoved(safeEvent.data);
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
                'Ignoring unknown user event in user-service',
              );

              await this.commitNextOffset(topic, partition, message.offset);
              return;
            }
          }
        } catch (error) {
          
        }
      }
    })
  }

  private async handleFollowCreated(event: FollowCreatedEvent): Promise<void> {
    const data = event.data;

    logger.info(
      {
        eventName: event.eventName,
        eventId: event.eventId,
        followerId: data.followerId,
        followeeId: data.followeeId,
      },
      'Handling follow.created event in user-service',
    );

    await this.userService.handleFollowCreated(
      data.followerId,
      data.followeeId,
    );

  }

  private async handleFollowRemoved(event: FollowRemovedEvent): Promise<void> {
    const data = event.data;

    logger.info(
      {
        eventName: event.eventName,
        eventId: event.eventId,
        followerId: data.followerId,
        followeeId: data.followeeId,
      },
      'Handling follow.removed event in user-service',
    );

    await this.userService.handleFollowRemoved(
      data.followerId,
      data.followeeId,
    );

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

    logger.error(context, 'Sent social graph event to DLQ from user-service');
  }
  
}