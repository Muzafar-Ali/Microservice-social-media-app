import { Producer } from "kafkajs";
import { KAFKA_TOPICS } from "./topics.js";

type UserCreatedPayload = {
  id: number;
  email: string;
  username: string;
  name: string | null;
  createdAt: Date;
};

type ProfileImageUpdatedPayload = {
  userId: number;
  profileImageUrl: string;
  updatedAt: Date;
};

export class UserEventPublisher  {

  constructor(private producer: Producer) {}

  publishUserCreated = async ( userData: UserCreatedPayload) => {
    try {

      await this.producer.send({
        topic: KAFKA_TOPICS.USER_CREATED,
        messages: [
          { 
            key: String(userData.id), 
            value: JSON.stringify(userData)
          }
        ]
      });
      
      console.log(`Published ${KAFKA_TOPICS.USER_CREATED} event for user: ${userData.username}`);
      
    } catch (error) {
      console.error(`Failed to ${KAFKA_TOPICS.USER_CREATED} event:`, error);
    }
  }

  publishProfileImageUploadRequested = async (payload: {
    userId: number,
    rawImage: string
  }) => {
    try {
      await this.producer.send({
        topic: KAFKA_TOPICS.PROFILE_IMAGE_UPLOAD_REQUESTED,
        messages: [
          {
            key: String(payload.userId),
            value: JSON.stringify({
              userId: payload.userId,
              rawImage: payload.rawImage,
              requestedAt: new Date().toISOString()
            })
          }
        ]
      })

      console.log(`Published ${KAFKA_TOPICS.PROFILE_IMAGE_UPLOAD_REQUESTED} event for user: ${payload.userId}`);
    } catch (error) {
      console.error(`Failed to publish ${KAFKA_TOPICS.PROFILE_IMAGE_UPLOAD_REQUESTED} event:`, error);
      
    }
  }

  publishProfileImageUpdated = async (payload: ProfileImageUpdatedPayload) => {
    try {
      await this.producer.send({
        topic: KAFKA_TOPICS.PROFILE_IMAGE_UPDATED,
        messages: [
          {
            key: String(payload.userId),
            value: JSON.stringify(payload),
          },
        ],
      });
  
      console.log(`Published ${KAFKA_TOPICS.PROFILE_IMAGE_UPDATED} event for userId: ${payload.userId}`);
      
    } catch (error) {
      console.error(`Failed to publish ${KAFKA_TOPICS.PROFILE_IMAGE_UPDATED} event:`, error);
    }
  }
}