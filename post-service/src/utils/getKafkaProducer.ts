import { Producer } from "kafkajs";
import kafka from "../config/kafkaClient.js";

let producer: Producer | null = null;

const getKafkaProducer = async () => {
  if (!producer) {
    producer = kafka.producer();
    await producer.connect();
    console.log('[Kafka] Producer connected (post-service)');
  }
  
  return producer;
};

export default getKafkaProducer;
