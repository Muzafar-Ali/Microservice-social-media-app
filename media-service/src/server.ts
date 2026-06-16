import './observability/instrumentation.js';

import { createApp } from './app.js';
import { initRedis } from './config/redisClient.js';
import PostEventConsumer from './events/consumers/post-event.consumer.js';
import MediaRespository from './repositories/media.repository.js';
import MediaService from './services/media.service.js';
import executeWithRetry from './utils/executeWithRetry.js';
import createKafkaTopic from './utils/kafka/createKafkaTopic.js';
import getKafkaProducer from './utils/kafka/getKafkaProducer.js';
import getPostKafkaConsumer from './utils/kafka/getPostKafkaConsumer.js';
import logger from './utils/logger.js';

const PORT = process.env.PORT || 4002;

type RuntimeRole = 'api' | 'worker' | 'all';

const shouldCreateKafkaTopicsOnStartup = () => {
  return (process.env.KAFKA_CREATE_TOPICS_ON_STARTUP ?? 'true').toLowerCase() !== 'false';
};

const createKafkaTopicsIfEnabled = async () => {
  if (!shouldCreateKafkaTopicsOnStartup()) {
    logger.info('[Kafka] Topic creation skipped by KAFKA_CREATE_TOPICS_ON_STARTUP');
    return;
  }

  await executeWithRetry('Kafka topic creation', createKafkaTopic);
};

// Allows the same Docker image to run as API-only, worker-only,
// or both for local/dev and backward-compatible deployments
const getRuntimeRole = (): RuntimeRole => {
  const role = (process.env.SERVICE_RUNTIME_ROLE ?? 'all').toLowerCase();

  if (role === 'api' || role === 'worker' || role === 'all') {
    return role;
  }

  logger.warn({ role }, 'Invalid SERVICE_RUNTIME_ROLE value. Falling back to all.');
  return 'all';
};

const startHttpServer = async () => {
  await initRedis();

  // API runtime only starts HTTP dependencies.
  // Kafka consumers and outbox workers are started separately in worker mode.
  const app = await createApp();

  app.listen(PORT, () => {
    logger.info(`media-service API is listening at ${PORT}`);
  });
};

const startBackgroundWorkers = async () => {
  // Worker runtime owns Kafka consumers and outbox publishing.
  // Keeping it separate from API pods allows independent scaling.
  await createKafkaTopicsIfEnabled();

  const producer = await getKafkaProducer();
  const postKafkaConsumer = await getPostKafkaConsumer();
  const mediaRepository = new MediaRespository();
  const mediaService = new MediaService(mediaRepository);
  const postEventConsumer = new PostEventConsumer(postKafkaConsumer, producer, mediaService);

  await executeWithRetry('PostEventConsumer start', () => postEventConsumer.start());
  logger.info('[Kafka] Post event consumer started');
};

async function bootstrap() {
  try {
    const runtimeRole = getRuntimeRole();

    // SERVICE_RUNTIME_ROLE controls deployment behavior:
    // api    = HTTP server only
    // worker = Kafka consumers and outbox workers only
    // all    = both, useful for local/dev or backward compatibility.
    if (runtimeRole === 'api' || runtimeRole === 'all') {
      await startHttpServer();
    }

    if (runtimeRole === 'worker' || runtimeRole === 'all') {
      await startBackgroundWorkers();
    }

    logger.info({ runtimeRole }, 'Media service runtime started');
  } catch (err) {
    logger.error({ err }, 'Failed to start media-service');
    process.exit(1);
  }
}

bootstrap();
