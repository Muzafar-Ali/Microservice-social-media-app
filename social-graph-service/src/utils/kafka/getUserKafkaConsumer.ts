import { Consumer } from 'kafkajs';
import kafka from '../../config/kafkaClient.js';

let consumer: Consumer | null = null;

const getUserKafkaConsumer = async () => {
  if (!consumer) {
    consumer = kafka.consumer({
      groupId: 'social-graph-user-events',
    });

    await consumer.connect();
    console.log('[Kafka] Consumer connected (social-graph-service)');
  }

  return consumer;
};

export default getUserKafkaConsumer;
