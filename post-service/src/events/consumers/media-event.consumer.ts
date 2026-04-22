import { Consumer, Producer } from "kafkajs";
import { PostService } from "../../services/post.service.js";
import { KAFKA_TOPICS, MEDIA_EVENT_NAMES } from "../topics.js";
import logger from "../../utils/logger.js";
import { FailedMessageContext, MediaDeletedPayload, MediaUploadCompletedPayload } from "../../types/post-event-consumer.types..js";

class MediaEventConsumer {
  constructor(
    private readonly consumer: Consumer,
    private readonly dlqProducer: Producer,
    private readonly postService: PostService
  ) {}

  public async start(): Promise<void> {
    await this.consumer.subscribe({
      topic: KAFKA_TOPICS.MEDIA_EVENTS,
      fromBeginning: false,
    });

    await this.consumer.run({
      autoCommit: false,
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) {
          logger.warn(
            { topic, partition, offset: message.offset },
            "Received empty Kafka message"
          );

          await this.commitNextOffset(topic, partition, message.offset);
          return;
        }

        const rawValue = message.value.toString();

        try {
          const parsedJson = JSON.parse(rawValue);

          switch (parsedJson.eventName) {
            case MEDIA_EVENT_NAMES.MEDIA_UPLOAD_COMPLETED: {
              await this.handleMediaUploadCompleted(parsedJson);
              await this.commitNextOffset(topic, partition, message.offset);
              return;
            }

            case MEDIA_EVENT_NAMES.MEDIA_DELETED: {
              await this.handleMediaDeleted(parsedJson);
              await this.commitNextOffset(topic, partition, message.offset);
              return;
            }

            default: {
              logger.warn(
                {
                  topic,
                  partition,
                  offset: message.offset,
                  eventName: parsedJson.eventName,
                },
                "Ignoring unknown media event"
              );

              await this.commitNextOffset(topic, partition, message.offset);
              return;
            }
          }
        } catch (error) {
          logger.error(
            {
              error,
              topic,
              partition,
              offset: message.offset,
              rawValue,
            },
            "Failed to process media Kafka message"
          );

          // No offset commit here: allows retry/redelivery
        }
      },
    });
  }

  private async handleMediaUploadCompleted(event: {
    eventName: string;
    data: MediaUploadCompletedPayload;
  }): Promise<void> {
    const data = event.data;

    logger.info(
      {
        eventName: event.eventName,
        postId: data.postId,
        mediaType: data.mediaType,
      },
      "Handling media.upload.completed event in post-service"
    );

    // await this.postService.attachMediaToPost(data.postId, {
    //   mediaId: data.publicId,
    //   secureUrl: data.secureUrl,
    //   mediaType: data.mediaType,
    // });
  }

  private async handleMediaDeleted(event: {
    eventName: string;
    data: MediaDeletedPayload;
  }): Promise<void> {
    const data = event.data;

    logger.info(
      {
        eventName: event.eventName,
        postId: data.postId,
        mediaId: data.mediaId,
      },
      "Handling media.deleted event in post-service"
    );

    // await this.postService.detachMediaFromPost(data.postId, data.mediaId);
  }

  private async commitNextOffset(
    topic: string,
    partition: number,
    currentOffset: string
  ): Promise<void> {
    const nextOffset = (BigInt(currentOffset) + 1n).toString();

    await this.consumer.commitOffsets([
      {
        topic,
        partition,
        offset: nextOffset,
      },
    ]);

    logger.info(
      { topic, partition, committedOffset: nextOffset },
      "Committed media Kafka offset"
    );
  }

  private async sendToDlq(context: FailedMessageContext): Promise<void> {
    await this.dlqProducer.send({
      topic: KAFKA_TOPICS.POST_SERVICE_MEDIA_EVENTS_DLQ,
      acks: -1,
      messages: [
        {
          key: `${context.topic}:${context.partition}:${context.offset}`,
          value: JSON.stringify({
            failedAt: new Date().toISOString(),
            sourceTopic: context.topic,
            sourcePartition: context.partition,
            sourceOffset: context.offset,
            rawValue: context.rawValue,
            reason: context.reason,
            consumerService: "post-service",
            consumerGroup: "post-service-media-events",
          }),
        },
      ],
    });

    logger.error(context, "Sent media event to DLQ");
  }
}

export default MediaEventConsumer;