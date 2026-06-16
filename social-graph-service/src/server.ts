import './observability/instrumentation.js';

import { createApp } from './app.js';
import config from './config/config.js';
import prisma from './config/prismaClient.js';
import { initRedis } from './config/redisClient.js';
import UserEventConsumer from './events/consumers/user-event.consumer.js';
import { SocialGraphEventPublisher } from './events/socialGraph-producer.js';
import { SocialGraphRepository } from './repository/socialGraph.repository.js';
import { SocialGraphService } from './services/socialGraph.service.js';
import executeWithRetry from './utils/executeWithRetry.js';
import createKafkaTopic from './utils/kafka/createKafkaTopic.js';
import getKafkaProducer from './utils/kafka/getKafkaProducer.js';
import getUserKafkaConsumer from './utils/kafka/getUserKafkaConsumer.js';
import logger from './utils/logger.js';
import { OutboxWorker } from './workers/outbox.worker.js';

const PORT = config.port;

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
    logger.info(`social-graph-service API is listening at ${PORT}`);
  });
};

const startBackgroundWorkers = async () => {
  // Worker runtime owns Kafka consumers and outbox publishing.
  // Keeping it separate from API pods allows independent scaling.
  await createKafkaTopicsIfEnabled();

  const producer = await getKafkaProducer();
  const userKafkaConsumer = await getUserKafkaConsumer();
  const socialGraphRepository = new SocialGraphRepository(prisma);
  const socialGraphEventPublisher = new SocialGraphEventPublisher(producer);
  const socialGraphService = new SocialGraphService(socialGraphRepository);
  const userEventConsumer = new UserEventConsumer(userKafkaConsumer, producer, socialGraphService);
  const outboxWorker = new OutboxWorker(prisma, socialGraphEventPublisher);

  await executeWithRetry('Kafka consumer start', () => userEventConsumer.start());
  logger.info('[Kafka] User event consumer started');

  let isOutboxWorkerRunning = false;

  setInterval(async () => {
    if (isOutboxWorkerRunning) return;

    isOutboxWorkerRunning = true;

    try {
      await outboxWorker.processPendingEvents();
    } catch (error) {
      logger.error({ error }, 'Outbox worker failed');
    } finally {
      isOutboxWorkerRunning = false;
    }
  }, 5000);

  logger.info('[Outbox] Worker started');

  let isOutboxCleanupRunning = false;

  setInterval(
    async () => {
      // Prevent overlapping cleanup jobs during slow database operations.
      if (isOutboxCleanupRunning) return;

      isOutboxCleanupRunning = true;

      try {
        await outboxWorker.cleanupPublishedEvents();
      } catch (error) {
        logger.error({ error }, 'Outbox cleanup failed');
      } finally {
        isOutboxCleanupRunning = false;
      }
    },
    24 * 60 * 60 * 1000,
  );

  logger.info('[Outbox] Cleanup worker started');
};

async function bootstrap() {
  try {
    // SERVICE_RUNTIME_ROLE controls deployment behavior:
    // api    = HTTP server only
    // worker = Kafka consumers and outbox workers only
    // all    = both, useful for local/dev or backward compatibility.
    const runtimeRole = getRuntimeRole();

    if (runtimeRole === 'api' || runtimeRole === 'all') {
      await startHttpServer();
    }

    if (runtimeRole === 'worker' || runtimeRole === 'all') {
      await startBackgroundWorkers();
    }

    logger.info({ runtimeRole }, 'Social graph service runtime started');
  } catch (err) {
    logger.error({ err }, 'Failed to start social-graph-service');
    process.exit(1);
  }
}

bootstrap();
