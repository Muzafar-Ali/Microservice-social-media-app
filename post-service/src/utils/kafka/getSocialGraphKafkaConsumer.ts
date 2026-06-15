import { Consumer } from 'kafkajs';
import kafka from '../../config/kafkaClient.js';
import logger from '../logger.js';

let consumer: Consumer | null = null;

const getSocialGraphKafkaConsumer = async (): Promise<Consumer> => {
  if (!consumer) {
    consumer = kafka.consumer({
      groupId: 'post-service-social-graph-events',
    });

    await consumer.connect();
    logger.info('[Kafka] Social graph consumer connected (post-service)');
  }

  return consumer;
};

export default getSocialGraphKafkaConsumer;
