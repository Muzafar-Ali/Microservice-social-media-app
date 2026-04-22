import { Producer } from "kafkajs";
import kafka from "../../config/kafkaClient.js";
import logger from "../logger.js";

let producer: Producer | null = null;

const getKafkaProducer = async (): Promise<Producer> => {
  if (!producer) {
    producer = kafka.producer({
      allowAutoTopicCreation: false,
      idempotent: true,
      maxInFlightRequests: 1,
      // retry: {
      //   retries: 10,
      // },
    });

    await producer.connect();
    logger.info('[Kafka] Producer connected (media-service)');
  }

  return producer;
};

export default getKafkaProducer;