import { Producer } from "kafkajs";
import { KAFKA_TOPICS } from "./topics.js";
import logger from "../utils/logger.js";

type CreatePostDataPayload = {
  content: string;
  id: string;
  authorId: string;
  editedAt: Date | null;
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class PostEventPublisher {

  constructor(private producer: Producer) {}

  publishPostCreatedEvent = async (postData: CreatePostDataPayload) => {
    try {
      await this.producer.send({
        topic: KAFKA_TOPICS.POST_CREATED,
        messages: [
          {
            key: String(postData.id),
            value: JSON.stringify(postData)
          }
        ] 
      })

      logger.info(`Published ${KAFKA_TOPICS.POST_CREATED} event for post: ${postData.id}`);

    } catch (error) {
      logger.error(error, `Failed to ${KAFKA_TOPICS.POST_CREATED} event:`)
    }
  }
}