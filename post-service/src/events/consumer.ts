import { Consumer } from "kafkajs";
import { PostService } from "../services/post.service.js";
import { KAFKA_TOPICS } from "./topics.js";
import logger from "../utils/logger.js";

type PostMediaUpload = {
  userId: string;
  postId: string
  secureUrl: string;
  publicId: string;
  mediaType: string
}

class postEventConsumer {
  constructor(
    private readonly consumer: Consumer,
    private readonly postService: PostService
  ) {}

  start = async () => {

    // Subscribe only to topics this service actually handles
    await this.consumer.subscribe({
      topic: KAFKA_TOPICS.POST_VIDEO_OR_IMAGE_UPLOADED,
      fromBeginning: true
    });

    await this.consumer.run({
      autoCommit: false,
      eachMessage: async ({ topic, partition, message}) => {

        if(!message.value) {
          logger.warn("[Kafka] Received empty message value");
          return;
        }

        const rawValue = message.value.toString();

        try {
          
          switch(topic) {
            case KAFKA_TOPICS.POST_VIDEO_OR_IMAGE_UPLOADED:
            await this.handlePostMediaUpdate(rawValue, partition)
          }
        } catch (error) {
          logger.error({
            error,
            topic,
            partition,
            rawValue
          }, `[Kafka] Failed to process message` )
        }
      }
    })
  }

  // --- Handlers per topic -----------------------------------------
  private handlePostMediaUpdate = async (rawData: string, partition: number) => {
    const data: PostMediaUpload  = JSON.parse(rawData);

    const typeOfMedia = data.mediaType === "image"
    
    try {
      await this.postService.updatePost(data.postId, data)
    } catch (error) {
      
    }
  }
}