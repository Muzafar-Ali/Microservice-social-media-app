import { Producer } from "kafkajs";
import logger from "src/utils/logger";

class MediaServiceEventPublisher {

  constructor( private producer: Producer) {}

  publishProfileImageUpdated = async (
    secureUrl: string,
    publicId: string,
    userId: number
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
      logger.error({error}, `Failed to publish ${KAFKA_TOPICS.PROFILE_IMAGE_UPDATED} event:`);
    }
  }

}

export default MediaServiceEventPublisher;