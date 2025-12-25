import { Consumer } from "kafkajs";
import { KAFKA_TOPICS } from "./topics.js";
import { UserService } from "../modules/user/user.service.js";
import logger from "../utils/logger.js";

type ProfileImageUpdatedEvent = {
  userId: number;
  secureUrl: string;
  publicId: string;
};

// type UserDeactivatedEvent = {
//   userId: number;
//   reason?: string;
//   deactivatedAt: string;
// };

class UserEventConsumer {

  constructor( private readonly consumer: Consumer, private readonly userService: UserService) {}

  start = async () => {
    // Subscribe only to topics this service actually handles
    await this.consumer.subscribe({
      topic: KAFKA_TOPICS.PROFILE_IMAGE_UPDATED,
      fromBeginning: false,
    });

    // await this.consumer.subscribe({
    //   topic: KAFKA_TOPICS.USER_DEACTIVATED,
    //   fromBeginning: false,
    // });

    await this.consumer.run({
      /* Disable auto-commit so Kafka does NOT mark message as consumed
       * unless we explicitly say so.
       */
      autoCommit: false,
      eachMessage: async ({ topic, partition, message }) => {

        if (!message.value) {
          logger.warn("[Kafka] Received empty message value");
          return;
        }

        const rawValue = message.value.toString();

        try {

          switch (topic) {
            case KAFKA_TOPICS.PROFILE_IMAGE_UPDATED:
              await this.handleProfileImageUpdated(rawValue, partition);
              break;

            // case KAFKA_TOPICS.USER_DEACTIVATED:
            //   await this.handleUserDeactivated(rawValue, partition);
            //   break;

            default:
              logger.warn(`[Kafka] Received message for unknown topic: ${topic}`);
              return;
          }

          /**
           * ✅ COMMIT OFFSET ONLY AFTER SUCCESS
           * Kafka expects "next offset", not current one
           */
          await this.consumer.commitOffsets([
            {
              topic,
              partition,
              offset: (Number(message.offset) + 1).toString()
            }
          ]);

          logger.info( `[Kafka] Offset committed for topic=${topic}, partition=${partition}, offset=${message.offset}`);

        } catch (error) {

          logger.error(
            {
              error,
              topic,
              partition,
              rawValue,
            },
            `[Kafka] Failed to process message`
          );

        }
      },
    });

    // logger.info(
    //   `[Kafka] UserEventConsumer started for topics: 
    //   ${KAFKA_TOPICS.PROFILE_IMAGE_UPDATED}, 
    //   ${KAFKA_TOPICS.USER_DEACTIVATED}`
    // );
  };

  // --- Handlers per topic -----------------------------------------

  private handleProfileImageUpdated = async( rawData: string, partition: number ) => {
    const payload: Partial<ProfileImageUpdatedEvent> = JSON.parse(rawData);

    if (!payload.publicId || !payload.secureUrl || !payload.userId) {
      logger.warn(`[Kafka] Invalid PROFILE_IMAGE_UPDATED payload: ${JSON.stringify(payload)}`);
      return;
    }
    
    try {
      await this.userService.updateUserProfileImage(
        {
          secureUrl: payload.secureUrl,
          publicId: payload.publicId,
        },
        payload.userId
      );

      logger.info(`[Kafka] PROFILE_IMAGE_UPDATED for userId=${payload.userId}, partition=${partition}`);
    } catch (error) {
      logger.error({ error }, `[Kafka] PROFILE_IMAGE_UPDATED Failed to update image for userId=${payload.userId}, partition=${partition}`)
      throw error;
    }

  }

  // private async handleUserDeactivated(
  //   rawData: string,
  //   partition: number
  // ): Promise<void> {
  //   const payload: Partial<UserDeactivatedEvent> = JSON.parse(rawData);

  //   if (!payload.userId || !payload.deactivatedAt) {
  //     logger.warn(
  //       `[Kafka] Invalid USER_DEACTIVATED payload: ${JSON.stringify(payload)}`
  //     );
  //     return;
  //   }

  //   logger.info(
  //     `[Kafka] USER_DEACTIVATED for userId=${payload.userId}, partition=${partition}, reason=${payload.reason ?? "N/A"}`
  //   );

  //   await this.userService.deactivateUser(
  //     payload.userId,
  //     payload.reason ?? null,
  //     payload.deactivatedAt
  //   );
  // }
}

export default UserEventConsumer;
