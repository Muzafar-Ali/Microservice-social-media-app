import { Consumer } from "kafkajs";
import kafka from "../config/kafkaClient.js";

let consumer: Consumer | null = null;

const getKafkaConsumer = async () => {
  if (!consumer) {
    consumer = kafka.consumer({
      groupId: "user-service-profile-image-updated-group",
    });

    await consumer.connect();
    console.log("[Kafka] Consumer connected (user-service)");
  }

  return consumer;
};

export default getKafkaConsumer;
