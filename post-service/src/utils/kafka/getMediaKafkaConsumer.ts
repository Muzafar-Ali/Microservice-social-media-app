import { Consumer } from "kafkajs";
import kafka from "../../config/kafkaClient.js";
import logger from "../logger.js";

let consumer: Consumer | null = null;

const getMediaKafkaConsumer = async (): Promise<Consumer> => {
  if (!consumer) {
    consumer = kafka.consumer({
      groupId: "post-service-media-events",
    });

    await consumer.connect();
    logger.info("[Kafka] Media consumer connected (post-service)");
  }

  return consumer;
};

export default getMediaKafkaConsumer;