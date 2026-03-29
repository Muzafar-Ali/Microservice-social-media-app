import { Consumer } from "kafkajs";
import { PostService } from "../services/post.service.js";
import { KAFKA_TOPICS, MEDIA_EVENT_NAMES, USER_EVENT_NAMES } from "./topics.js";
import logger from "../utils/logger.js";

type MediaUploadCompletedPayload = {
  userId: string;
  postId: string;
  secureUrl: string;
  publicId: string;
  mediaType: "image" | "video";
};

class PostEventConsumer {
  constructor(
    private readonly consumer: Consumer,
    private readonly postService: PostService
  ) {}

  start = async () => {

    // Subscribe only to topics this service actually handles
    await this.consumer.subscribe({
      topic: KAFKA_TOPICS.MEDIA_EVENTS,
      fromBeginning: false,
    });

    await this.consumer.subscribe({
      topic: KAFKA_TOPICS.USER_EVENTS,
      fromBeginning: false,
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
              await this.handleMediaUploadCompleted(event)
              break;

            case MEDIA_EVENT_NAMES.MEDIA_DELETED:
              await this.handleMediaDeleted(event);
              break;
            
            case USER_EVENT_NAMES.USER_CREATED:
              await this.handleUserCreated(event);
              break;
            
            default: 
              logger.warn(
                { 
                  eventName: event.eventName, 
                  topic, 
                  partition, 
                  offset: message.offset 
                },
                "[Kafka] Unknown event name"
              );
              break;
          };

          await this.consumer.commitOffsets([{
            topic,
            partition,
            offset: (BigInt(message.offset) + 1n).toString(),
          }])

        logger.info(
          { 
            topic, 
            partition, 
            committedOffset: (BigInt(message.offset) + 1n).toString(), 
          },
          "[Kafka] Message processed and offset committed"
        );

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

  private async handleUserCreated(event: any): Promise<void> {
    const data = event.data;

    logger.info(
      {
        eventName: event.eventName,
        userId: data.userId,
        username: data.username,
      },
      "Handling user.created event"
    );

    try {
      const result = await this.postService.upsertUserProfileCache({
        userId: data.userId,
        username: data.username,
        displayName: data.displayName ?? null,
        avatarUrl: data.avatarUrl?.secureUrl ?? data.avatarUrl ?? null,
        status: data.status,
      });

      logger.info({ result }, "UserProfileCache upsert success");
    } catch (error) {
      logger.error({ error, data }, "UserProfileCache upsert failed");
      throw error;
    }
  }
}

export default PostEventConsumer;