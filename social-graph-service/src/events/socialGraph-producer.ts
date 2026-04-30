import { Producer } from 'kafkajs';
import { KAFKA_TOPICS, SOCIAL_GRAPH_EVENT_NAMES } from './socialGraph-event.topics.js';
import logger from '../utils/logger.js';
import {
  FollowCreatedEvent,
  FollowCreatedPayload,
  UnFollowCreatedEvent,
  UnFollowCreatedPayload,
} from '../types/social-graph-event-publisher.types.js';
import { FollowStatus } from '../generated/prisma/enums.js';
import config from '../config/config.js';

export class SocialGraphEventPublisher {
  private readonly producerServiceName = config.serviceName;

  constructor(private readonly producer: Producer) {}

  public async publishFollowCreated(payload: FollowCreatedPayload, eventId: string): Promise<void> {
    const event: FollowCreatedEvent = {
      eventId,
      eventName:
        payload.status === FollowStatus.PENDING
          ? SOCIAL_GRAPH_EVENT_NAMES.FOLLOW_REQUESTED
          : SOCIAL_GRAPH_EVENT_NAMES.FOLLOW_CREATED,
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      producerService: this.producerServiceName,
      partitionKey: payload.followerId,
      data: payload,
    };

    await this.publishEvent(event);
  }

  public async publishFollowRemoved(payload: UnFollowCreatedPayload, eventId: string): Promise<void> {
    const event: UnFollowCreatedEvent = {
      eventId,
      eventName: SOCIAL_GRAPH_EVENT_NAMES.FOLLOW_REMOVED,
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      producerService: this.producerServiceName,
      partitionKey: payload.followerId,
      data: payload,
    };

    await this.publishEvent(event);
  }

  private async publishEvent(event: FollowCreatedEvent | UnFollowCreatedEvent): Promise<void> {
    try {
      await this.producer.send({
        topic: KAFKA_TOPICS.SOCIAL_GRAPH_EVENTS,
        acks: -1,
        messages: [
          {
            key: event.partitionKey,
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
          partitionKey: event.partitionKey,
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
          partitionKey: event.partitionKey,
          topic: KAFKA_TOPICS.SOCIAL_GRAPH_EVENTS,
        },
        'Failed to publish social graph event',
      );

      throw error;
    }
  }
}
