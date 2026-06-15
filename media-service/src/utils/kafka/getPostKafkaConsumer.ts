import { Consumer } from 'kafkajs';
import kafka from '../../config/kafkaClient.js';
import logger from '../logger.js';

let consumer: Consumer | null = null;

const getPostKafkaConsumer = async (): Promise<Consumer> => {
  if (!consumer) {
    consumer = kafka.consumer({
      groupId: 'media-service-post-events',
    });

    await consumer.connect();
    logger.info('[Kafka] Post consumer connected (media-service)');
  }

  return consumer;
};

export default getPostKafkaConsumer;
