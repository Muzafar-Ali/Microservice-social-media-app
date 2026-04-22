import { Consumer } from 'kafkajs';
import kafka from '../../config/kafkaClient.js';
import logger from '../logger.js';


let consumer: Consumer | null = null;

const getUserKafkaConsumer = async () => {
  if (!consumer) {
    consumer = kafka.consumer({
      groupId: 'social-graph-user-events',
    });

    await consumer.connect();
    logger.info('[Kafka] Consumer connected (social-graph-service)');
  }

  return consumer;
};

export default getUserKafkaConsumer;
