import { Producer } from 'kafkajs';
import { KAFKA_TOPICS, POST_EVENT_NAMES } from './topics.js';
import logger from '../utils/logger.js';
import {
  PostCreatedEventPayload,
  PostDeletedEventPayload,
  PostUpdatedEventPayload,
} from '../types/post-event-publisher.types.js';
import config from '../config/config.js';

export class PostEventPublisher {
  private readonly producerServiceName = config.serviceName;

  constructor(private readonly producer: Producer) {}

  async publishPostCreated(payload: PostCreatedEventPayload, eventId: string): Promise<void> {
    await this.publishEvent(POST_EVENT_NAMES.POST_CREATED, payload, eventId);
  }

  async publishPostUpdated(payload: PostUpdatedEventPayload, eventId: string): Promise<void> {
    await this.publishEvent(POST_EVENT_NAMES.POST_UPDATED, payload, eventId);
  }

  async publishPostDeleted(payload: PostDeletedEventPayload, eventId: string): Promise<void> {
    await this.publishEvent(POST_EVENT_NAMES.POST_DELETED, payload, eventId);
  }

  private async publishEvent(
    eventName:
      | typeof POST_EVENT_NAMES.POST_CREATED
      | typeof POST_EVENT_NAMES.POST_UPDATED
      | typeof POST_EVENT_NAMES.POST_DELETED,
    payload: PostCreatedEventPayload | PostUpdatedEventPayload | PostDeletedEventPayload,
    eventId: string,
  ): Promise<void> {
    const event = {
      eventId,
      eventName,
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      producerService: this.producerServiceName,
      partitionKey: payload.postId,
      data: payload,
    };

    try {
      await this.producer.send({
        topic: KAFKA_TOPICS.POST_EVENTS,
        acks: -1,
        messages: [
          {
            key: payload.postId,
            value: JSON.stringify(event),
            headers: {
              eventName,
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
          eventName,
          eventId: event.eventId,
          postId: payload.postId,
          topic: KAFKA_TOPICS.POST_EVENTS,
        },
        'Published post event',
      );
    } catch (error) {
      logger.error(
        {
          error,
          eventName,
          eventId: event.eventId,
          postId: payload.postId,
          topic: KAFKA_TOPICS.POST_EVENTS,
        },
        'Failed to publish post event',
      );
      throw error;
    }
  }
}
