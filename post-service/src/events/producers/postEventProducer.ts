import { Producer } from "kafkajs";
import { KAFKA_TOPICS, POST_EVENT_NAMES } from "../topics.js";
import logger from "../../utils/logger.js";


type PostCreatedEventPayload = {
  postId: string;
  authorId: string;
  content: string;
  isEdited: boolean;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

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
        messages: [
          {
            key: payload.postId,
            value: JSON.stringify(event),
            headers: {
              eventName: event.eventName,
              eventVersion: String(event.eventVersion),
              producerService: event.producerService,
            },
          },
        ],
      });

      logger.info(`Published ${event.eventName} for post ${payload.postId}`);
    } catch (error) {
      logger.error(error, `Failed to publish ${event.eventName}`);
      throw error;
    }
  }
}