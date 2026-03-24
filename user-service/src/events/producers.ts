import { Producer } from "kafkajs";
import { KAFKA_TOPICS, USER_EVENT_NAMES } from "./topics.js";
import logger from "../utils/logger.js";

type UserCreatedPayload = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: {
    secureUrl: string,
    publicId: string
  } | null
  status: string;
  createdAt: Date;
  updatedAt?: Date;
};


export class UserEventPublisher  {

  private readonly producerServiceName = "user-service";
  constructor(private producer: Producer) {}

  publishUserCreated = async ( payload: UserCreatedPayload) => {

    const event = {
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
        messages: [
          { 
            key: payload.userId, 
            value: JSON.stringify(event),
            headers: {
              eventName: event.eventName,
              eventVersion: String(event.eventVersion),
              producerService: event.producerService,
            },
          }
        ],
      });
      
      logger.info(`Published ${event.eventName} for post ${payload.userId}`);
    } catch (error) {
      logger.error(error, `Failed to publish ${event.eventName}`);
      throw error;
    }
  }

}