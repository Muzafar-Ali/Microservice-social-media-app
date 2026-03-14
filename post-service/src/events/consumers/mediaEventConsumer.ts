import { Consumer } from "kafkajs";
import { PostService } from "../../services/post.service.js";
import { KAFKA_TOPICS, MEDIA_EVENT_NAMES } from "../topics.js";
import logger from "../../utils/logger.js";

type MediaUploadCompletedPayload = {
  userId: string;
  postId: string;
  secureUrl: string;
  publicId: string;
  mediaType: "image" | "video";
};

class postEventConsumer {
  constructor(
    private readonly consumer: Consumer,
    private readonly postService: PostService
  ) {}

  start = async () => {

    // Subscribe only to topics this service actually handles
    await this.consumer.subscribe({
      topic: KAFKA_TOPICS.MEDIA_EVENTS,
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
          const event = JSON.parse(rawValue);

          switch(event.eventName) {
            case MEDIA_EVENT_NAMES.MEDIA_UPLOAD_COMPLETED:
            await this.handleMediaUploadCompleted(rawValue)

            case MEDIA_EVENT_NAMES.MEDIA_DELETED:
              await this.handleMediaDeleted(event);
              break;
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

 // --- Handlers per event -----------------------------------------

  private async handleMediaUploadCompleted(event: any): Promise<void> {
    const data = event.data as MediaUploadCompletedPayload;

    logger.info(
      {
        eventName: event.eventName,
        postId: data.postId,
        mediaType: data.mediaType,
      },
      "Handling media.upload.completed event"
    );

    // await this.postService.attachMediaToPost(data.postId, {
    //   mediaId: data.publicId,
    //   secureUrl: data.secureUrl,
    //   mediaType: data.mediaType,
    // });
  }

  private async handleMediaDeleted(event: any): Promise<void> {
    const data = event.data;

    logger.info(
      {
        eventName: event.eventName,
        postId: data.postId,
        mediaId: data.mediaId,
      },
      "Handling media.deleted event"
    );

    // await this.postService.detachMediaFromPost(data.postId, data.mediaId);
  }
}