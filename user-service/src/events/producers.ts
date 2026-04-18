import crypto from "node:crypto";
import { Producer } from "kafkajs";
import { KAFKA_TOPICS, USER_EVENT_NAMES } from "./topics.js";
import logger from "../utils/logger.js";

export type BaseEvent<TData> = {
  eventId: string;
  eventName: string;
  eventVersion: number;
  occurredAt: string;
  producerService: string;
  partitionKey: string;
  data: TData;
};

export type UserCreatedPayload = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: {
    secureUrl: string;
    publicId: string;
  } | null;
  status: string;
  createdAt: string;
  updatedAt?: string;
};

export type UserCreatedEvent = BaseEvent<UserCreatedPayload>;

export class UserEventPublisher {
  private readonly producerServiceName = "user-service";

  constructor(private readonly producer: Producer) {}

  public async publishUserCreated(payload: UserCreatedPayload): Promise<void> {
    const event: UserCreatedEvent = {
      eventId: crypto.randomUUID(),
      eventName: USER_EVENT_NAMES.USER_CREATED,
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      producerService: this.producerServiceName,
      partitionKey: payload.userId,
      data: payload,
    };

    try {
      await this.producer.send({
        topic: KAFKA_TOPICS.USER_EVENTS,
        acks: -1,
        messages: [
          {
            key: payload.userId,
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
          userId: payload.userId,
          eventId: event.eventId,
          topic: KAFKA_TOPICS.USER_EVENTS,
        },
        "Published user event"
      );
    } catch (error) {
      logger.error(
        {
          error,
          eventName: event.eventName,
          userId: payload.userId,
          eventId: event.eventId,
          topic: KAFKA_TOPICS.USER_EVENTS,
        },
        "Failed to publish user event"
      );

      throw error;
    }
  }
}