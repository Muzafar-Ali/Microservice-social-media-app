import { Producer } from 'kafkajs';
import { KAFKA_TOPICS } from './socialGraph-event.topics.js';
import logger from '../utils/logger.js';
import {
  FollowCreatedEvent,
  FollowCreatedPayload,
  PublishSocialGraphEventInput,
  UnFollowCreatedEvent,
  UnFollowCreatedPayload,
} from '../types/social-graph-event-publisher.types.js';

export class SocialGraphEventPublisher {
  constructor(private readonly producer: Producer) {}

  public async publishFollowCreated(
    input: PublishSocialGraphEventInput<FollowCreatedPayload>,
  ): Promise<void> {
    const event: FollowCreatedEvent = {
      eventId: input.eventId,
      eventName: input.eventName,
      eventVersion: input.eventVersion,
      occurredAt: input.occurredAt,
      producerService: input.producerService,
      partitionKey: input.partitionKey,
      data: input.payload,
    };

    await this.publishEvent(event);
  }

  public async publishFollowRemoved(
    input: PublishSocialGraphEventInput<UnFollowCreatedPayload>,
  ): Promise<void> {
    const event: UnFollowCreatedEvent = {
      eventId: input.eventId,
      eventName: input.eventName,
      eventVersion: input.eventVersion,
      occurredAt: input.occurredAt,
      producerService: input.producerService,
      partitionKey: input.partitionKey,
      data: input.payload,
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