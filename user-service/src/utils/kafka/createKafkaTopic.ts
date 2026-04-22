import kafka from '../../config/kafkaClient.js';
import { KAFKA_TOPICS } from '../../events/topics.js';

import logger from '../logger.js';

const createKafkaTopic = async (): Promise<void> => {
  const admin = kafka.admin();
  await admin.connect();

  try {
    const created = await admin.createTopics({
      topics: [
        {
          topic: KAFKA_TOPICS.USER_EVENTS,
          numPartitions: 3,
          replicationFactor: 3,
          configEntries: [
            {
              name: 'min.insync.replicas',
              value: '2',
            },
          ],
        },
      ],
      waitForLeaders: true,
    });

    if (created) {
      logger.info('[Kafka] Topics created: user-service');
    } else {
      logger.info('[Kafka] Topic already exist: user-service');
    }
  } finally {
    await admin.disconnect();
  }
};

export default createKafkaTopic;
