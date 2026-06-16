import './observability/instrumentation.js';

import { createApp } from './app.js';
import config from './config/config.js';
import prisma from './config/prismaClient.js';
import { initRedis } from './config/redisClient.js';
import { SocialGraphEventConsumer } from './events/consumers/social-graph-event-consumer.js';
import { UserEventPublisher } from './events/producers.js';
import { UserRepository } from './modules/user/user.repository.js';
import { UserService } from './modules/user/user.service.js';
import { OutboxWorker } from './modules/user/user.outboxWorker.js';
import executeWithRetry from './utils/executeWithRetry.js';
import createKafkaTopic from './utils/kafka/createKafkaTopic.js';
import getKafkaProducer from './utils/kafka/getKafkaProducer.js';
import getSocialGraphKafkaConsumer from './utils/kafka/getSocialGraphKafkaConsumer.js';
import logger from './utils/logger.js';

const PORT = config.port;

type RuntimeRole = 'api' | 'worker' | 'all';

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
    logger.info(`user-service API is listening at ${PORT}`);
  });
};

const startBackgroundWorkers = async () => {

  // Worker runtime owns Kafka consumers and outbox publishing.
  // Keeping it separate from API pods allows independent scaling.
  await executeWithRetry('Kafka topic creation', createKafkaTopic);

  const producer = await getKafkaProducer();
  const socialGraphKafkaConsumer = await getSocialGraphKafkaConsumer();
  const userRepository = new UserRepository(prisma);
  const userService = new UserService(userRepository);
  const userEventPublisher = new UserEventPublisher(producer);
  const socialGraphEventConsumer = new SocialGraphEventConsumer(socialGraphKafkaConsumer, producer, userService);
  const outboxWorker = new OutboxWorker(prisma, userEventPublisher);

  await executeWithRetry('Kafka consumer start', () => socialGraphEventConsumer.start());
  logger.info('[Kafka] Social graph event consumer started');

  let isOutboxWorkerRunning = false;

  setInterval(async () => {

    // Prevent overlapping cleanup jobs during slow database operations.
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

  setInterval(async () => {
    if (isOutboxCleanupRunning) return;

    isOutboxCleanupRunning = true;

    try {
      await outboxWorker.cleanupPublishedEvents();
    } catch (error) {
      logger.error({ error }, 'Outbox cleanup failed');
    } finally {
      isOutboxCleanupRunning = false;
    }
  }, 24 * 60 * 60 * 1000);

  logger.info('[Outbox] Cleanup worker started');
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

    logger.info({ runtimeRole }, 'User service runtime started');
  } catch (err) {
    logger.error({ err }, 'Failed to start user-service');
    process.exit(1);
  }
}

bootstrap();
