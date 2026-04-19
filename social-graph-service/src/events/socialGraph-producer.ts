import crypto from 'node:crypto';
import { Producer } from 'kafkajs';
import { FollowStatus } from '../generated/prisma/enums.js';
import { KAFKA_TOPICS, SOCIAL_GRAPH_EVENT_NAMES } from './socialGraph-event.topics.js';
import logger from '../utils/logger.js';

export type BaseEvent<TData> = {
  eventId: string;
  eventName: string;
  eventVersion: number;
  occurredAt: string;
  producerService: string;
  partitionKey: string;
  data: TData;
};

export type FollowCreatedPayload = {
  followerId: string;
  followeeId: string;
  status: FollowStatus;
  createdAt: string;
};

export type UnFollowCreatedPayload = {
  followerId: string;
  followeeId: string;
  removedAt: string;
};

export type FollowCreatedEvent = BaseEvent<FollowCreatedPayload>;
export type UnFollowCreatedEvent = BaseEvent<UnFollowCreatedPayload>;

export class SocialGraphEventPublisher {
  private readonly producerServiceName = 'social-graph-service';

  constructor(private readonly producer: Producer) {}

  public async publishFollowCreated(payload: FollowCreatedPayload): Promise<void> {
    const eventName =
      payload.status === FollowStatus.PENDING
        ? SOCIAL_GRAPH_EVENT_NAMES.FOLLOW_REQUESTED
        : SOCIAL_GRAPH_EVENT_NAMES.FOLLOW_CREATED;

    const event: FollowCreatedEvent = {
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
        acks: -1,
        messages: [
          {
            key: payload.followerId,
            value: JSON.stringify(event),
            headers: {
              eventName: event.eventName,
              eventVersion: String(event.eventVersion),
              producerService: event.producerService,
              eventId: event.eventId,
              partitionKey: event.partitionKey,
            },
          },
        ],
      });

      logger.info(
        {
          eventName: event.eventName,
          eventId: event.eventId,
          followerId: payload.followerId,
          followeeId: payload.followeeId,
          topic: KAFKA_TOPICS.SOCIAL_GRAPH_EVENTS,
        },
        'Published social graph event',
      );
    } catch (error) {
      logger.error(
        {
          error,
          eventName: event.eventName,
          eventId: event.eventId,
          followerId: payload.followerId,
          followeeId: payload.followeeId,
          topic: KAFKA_TOPICS.SOCIAL_GRAPH_EVENTS,
        },
        'Failed to publish social graph event',
      );

      throw error;
    }
  }

  public async publishFollowRemoved(payload: UnFollowCreatedPayload): Promise<void> {
    const event: UnFollowCreatedEvent = {
      eventId: crypto.randomUUID(),
      eventName: SOCIAL_GRAPH_EVENT_NAMES.FOLLOW_REMOVED,
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      producerService: this.producerServiceName,
      partitionKey: payload.followerId,
      data: payload,
    };

    try {
      await this.producer.send({
        topic: KAFKA_TOPICS.SOCIAL_GRAPH_EVENTS,
        acks: -1,
        messages: [
          {
            key: payload.followeeId,
            value: JSON.stringify(event),
            headers: {
              eventName: event.eventName,
              eventVersion: String(event.eventVersion),
              producerService: event.producerService,
              eventId: event.eventId,
              partitionKey: event.partitionKey,
            },
          },
        ],
      });

      logger.info(
        {
          eventName: event.eventName,
          eventId: event.eventId,
          followerId: payload.followerId,
          followeeId: payload.followeeId,
          topic: KAFKA_TOPICS.SOCIAL_GRAPH_EVENTS,
        },
        'Published social graph event',
      );
    } catch (error) {
      logger.error(
        {
          error,
          eventName: event.eventName,
          eventId: event.eventId,
          followerId: payload.followerId,
          followeeId: payload.followeeId,
          topic: KAFKA_TOPICS.SOCIAL_GRAPH_EVENTS,
        },
        'Failed to publish social graph event',
      );

      throw error;
    }
  }
}
