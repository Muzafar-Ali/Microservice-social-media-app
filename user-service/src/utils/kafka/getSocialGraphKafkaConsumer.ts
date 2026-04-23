import { Consumer } from 'kafkajs';
import kafka from '../../config/kafkaClient.js';
import logger from '../logger.js';


let consumer: Consumer | null = null;

const getSocialGraphKafkaConsumer = async () => {
  if (!consumer) {
    consumer = kafka.consumer({
      groupId: 'user-service-social-graph-events',
    });

    await consumer.connect();
    logger.info('[Kafka] Consumer connected (user-service)');
  }

  return consumer;
};

export default getSocialGraphKafkaConsumer;
