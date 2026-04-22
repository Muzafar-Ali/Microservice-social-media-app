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
          topic: KAFKA_TOPICS.POST_EVENTS,
          numPartitions: 3,
          replicationFactor: 3,
          configEntries: [
            {
              name: 'min.insync.replicas',
              value: '2',
            },
          ],
        },
        //  USER EVENTS DLQ (dead letter queue)
        {
          topic: KAFKA_TOPICS.POST_SERVICE_USER_EVENTS_DLQ,
          numPartitions: 2,
          replicationFactor: 3,
          configEntries: [
            {
              name: 'min.insync.replicas',
              value: '2',
            },
          ],
        },
        //  MEDIA EVENTS DLQ (dead letter queue)
        {
          topic: KAFKA_TOPICS.POST_SERVICE_MEDIA_EVENTS_DLQ,
          numPartitions: 2,
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
      logger.info('[Kafka] Topics created: post-service');
    } else {
      logger.info('[Kafka] Topic already exist: post-service');
    }
  } finally {
    await admin.disconnect();
  }
};

export default createKafkaTopic;
