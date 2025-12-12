import { Producer } from "kafkajs";
import kafka from "../config/kafkaClient";

let producer: Producer | null = null;

const getKafkaProducer = async() => {
  if(!producer) {
    producer = kafka.producer();
    await producer.connect();
    
    console.log('[Kafka] Producer connected (user-service)');
  }
  
  return producer;
}

export default getKafkaProducer;