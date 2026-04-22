import crypto from 'node:crypto';
import { Producer } from "kafkajs";
import { KAFKA_TOPICS, POST_EVENT_NAMES } from "./topics.js";
import logger from "../utils/logger.js";
import { PostCreatedEventPayload } from '../types/post-event-publisher.types.js';


export class PostEventPublisher {
  
  private readonly producerServiceName = "post-service";
  constructor(private producer: Producer) {}

  async publishPostCreated(payload: PostCreatedEventPayload): Promise<void> {
    
    const event = {
      eventId: crypto.randomUUID(),
      eventName: POST_EVENT_NAMES.POST_CREATED,
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
              eventName: event.eventName,
              eventVersion: String(event.eventVersion),
              producerService: event.producerService,
              eventId: event.eventId,
              partitionKey: event.partitionKey
            },
          },
        ],
      });

      logger.info(
        {
          eventName: event.eventName,
          eventId: event.eventId,
          postId: payload.postId,
          topic: KAFKA_TOPICS.POST_EVENTS,
        },
        `Published posts event}`
      );
    } catch (error) {
      logger.error(
        {
          eventName: event.eventName,
          eventId: event.eventId,
          postId: payload.postId,
          topic: KAFKA_TOPICS.POST_EVENTS,
        },
        `Failed to publish post event`
      );
      throw error;
    }
  }
}