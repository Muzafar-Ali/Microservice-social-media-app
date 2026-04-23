import { Consumer } from 'kafkajs';
import kafka from '../../config/kafkaClient.js';
import logger from '../logger.js';

let consumer: Consumer | null = null;

const getUserKafkaConsumer = async (): Promise<Consumer> => {
  if (!consumer) {
    consumer = kafka.consumer({
      groupId: 'post-service-user-events',
    });

    await consumer.connect();
    logger.info('[Kafka] User consumer connected (post-service)');
  }

  return consumer;
};

export default getUserKafkaConsumer;
