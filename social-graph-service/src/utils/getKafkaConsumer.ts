import kafka from '../config/kafkaClient.js';
import { Consumer } from 'kafkajs';

let consumer: Consumer | null = null;

const getKafkaConsumer = async () => {
  if (!consumer) {
    consumer = kafka.consumer({
      groupId: 'social-graph-service-group',
    });

    await consumer.connect();
    console.log('[Kafka] Consumer connected (social-graph-service)');
  }

  return consumer;
};

export default getKafkaConsumer;
