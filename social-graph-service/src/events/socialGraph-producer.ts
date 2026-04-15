import { Producer } from 'kafkajs';
import { FollowStatus } from '../generated/prisma/enums.js';
import { KAFKA_TOPICS, SOCIAL_GRAPH_EVENT_NAMES } from './socialGraph-event.topics.js';
import logger from '../utils/logger.js';

type FollowCreatedPayload = {
  followerId: string;
  followeeId: string;
  status: FollowStatus;
  createdAt: Date;
};

export class SocialGraphEventPublisher {
  private readonly producerServiceName = 'social-graph-service';

  constructor(private producer: Producer) {}

  publishFollowCreated = async (payload: FollowCreatedPayload) => {
    const eventName =
      payload.status === FollowStatus.PENDING
        ? SOCIAL_GRAPH_EVENT_NAMES.FOLLOW_ACCEPTED
        : SOCIAL_GRAPH_EVENT_NAMES.FOLLOW_CREATED;

    const event = {
      eventId: crypto.randomUUID(),
      eventName,
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      producerService: this.producerServiceName,
      partitionKey: payload.followerId,
      data: payload,
    };

    try {
      await this.producer.send({
        topic: KAFKA_TOPICS.SOCIAL_GRAPH_EVENTS,
        messages: [
          {
            key: payload.followerId,
            value: JSON.stringify(event),
            headers: {
              eventName: event.eventName,
              eventVersion: String(event.eventVersion),
              producerService: event.producerService,
            },
          },
        ],
      });

      logger.info(`Published ${event.eventName} for follower ${payload.followerId}`);
    } catch (error) {
      logger.error(error, `Failed to publish ${event.eventName}`);
      throw error;
    }
  };
}
