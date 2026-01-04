import { Producer } from "kafkajs";
import logger from "../utils/logger";
import { KAFKA_TOPICS } from "./topics";


class MediaServiceEventPublisher {

  constructor( private producer: Producer) {}

  publishProfileImageUpdatedEvent = async (
    secureUrl: string,
    publicId: string,
    userId: string
  ) => {
    
    try {
      await this.producer.send({
        topic: KAFKA_TOPICS.PROFILE_IMAGE_UPDATED,
        messages: [
          {
            key: String(userId),
            value: JSON.stringify({
              secureUrl,
              publicId,
              userId
            }),
          },
        ],
      });
  
      logger.info(`Published ${KAFKA_TOPICS.PROFILE_IMAGE_UPDATED} event for userId: ${userId}`);
      
    } catch (error) {
      logger.error( {error}, `Failed to publish ${KAFKA_TOPICS.PROFILE_IMAGE_UPDATED} event:` );
    }
  }

  // publishPostMediaUploadedEvent = async (
  //   userId: string,
  //   postId: string,
  //   mediaType: string,
  //   secureUrl: string,
  //   publicId: string,
  // ) => {
  //   try {
  //     await this.producer.send({
  //       topic: KAFKA_TOPICS.POST_VIDEO_OR_IMAGE_UPLOADED,
  //       messages: [
  //         {
  //           key: String(userId),
  //           value: JSON.stringify({
  //             secureUrl,
  //             publicId,
  //             mediaType,
  //             userId,
  //             postId
  //           })
  //         }
  //       ]
  //     })

  //     logger.info(`Published ${KAFKA_TOPICS.POST_VIDEO_OR_IMAGE_UPLOADED} event for user: ${userId}`);

  //   } catch (error) {
  //     logger.error( {error},`Failed to publish ${KAFKA_TOPICS.POST_VIDEO_OR_IMAGE_UPLOADED} event:` )
  //   }
  // }

  // publishPostImageUploadedEvent = async (
  //   userId: string,
  //   postId: string,
  //   secureUrl: string,
  //   publicId: string,
  // ) => {
  //   try {
  //     await this.producer.send({
  //       topic: KAFKA_TOPICS.POST_VIDEO_OR_IMAGE_UPLOADED,
  //       messages: [
  //         {
  //           key: String(userId),
  //           value: JSON.stringify({
  //             secureUrl,
  //             publicId,
  //             userId,
  //             postId
  //           })
  //         }
  //       ]
  //     })

  //     logger.info(`Publihsed ${KAFKA_TOPICS.POST_VIDEO_OR_IMAGE_UPLOADED} event for user: ${userId}`)

  //   } catch (error) {
  //     logger.error( {error}, `Failed to publish ${KAFKA_TOPICS.POST_VIDEO_OR_IMAGE_UPLOADED} event:` )
  //   }
  // }

}

export default MediaServiceEventPublisher;