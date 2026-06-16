import { createApp } from './app.js';
import config from './config/config.js';
import prisma from './config/prismaClient.js';
import { initRedis } from './config/redisClient.js';
import UserEventConsumer from './events/consumers/user-event.consumer.js';
import SocialGraphEventConsumer from './events/consumers/social-graph-event.consumer.js';
import { PostEventPublisher } from './events/post-events.producer.js';
import { PostRepository } from './repositories/post.repository.js';
import { PostService } from './services/post.service.js';
import executeWithRetry from './utils/executeWithRetry.js';
import createKafkaTopic from './utils/kafka/createKafkaTopic.js';
import getKafkaProducer from './utils/kafka/getKafkaProducer.js';
import getSocialGraphKafkaConsumer from './utils/kafka/getSocialGraphKafkaConsumer.js';
import getUserKafkaConsumer from './utils/kafka/getUserKafkaConsumer.js';
import logger from './utils/logger.js';
import { OutboxWorker } from './workers/outbox.worker.js';

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
    logger.info(`Post service API is listening at ${PORT}`);
  });
};

const startBackgroundWorkers = async () => {
  // Worker runtime owns Kafka consumers and outbox publishing.
  // Keeping it separate from API pods allows independent scaling.
  await executeWithRetry('Kafka topic creation', createKafkaTopic);

  const producer = await getKafkaProducer();
  const userKafkaConsumer = await getUserKafkaConsumer();
  const socialGraphKafkaConsumer = await getSocialGraphKafkaConsumer();
  const postRepository = new PostRepository(prisma);
  const postEventPublisher = new PostEventPublisher(producer);
  const postService = new PostService(postRepository);
  const userEventConsumer = new UserEventConsumer(userKafkaConsumer, producer, postService);
  const socialGraphEventConsumer = new SocialGraphEventConsumer(socialGraphKafkaConsumer, producer, postService);
  const outboxWorker = new OutboxWorker(prisma, postEventPublisher);

  await executeWithRetry('UserEventConsumer start', () => userEventConsumer.start());
  await executeWithRetry('SocialGraphEventConsumer start', () => socialGraphEventConsumer.start());

  let isOutboxWorkerRunning = false;

  const processOutbox = async () => {
    if (isOutboxWorkerRunning) return;

    isOutboxWorkerRunning = true;

    try {
      await outboxWorker.processPendingEvents();
    } catch (error) {
      logger.error({ error }, 'Post outbox worker failed');
    } finally {
      isOutboxWorkerRunning = false;
    }
  };

  await processOutbox();
  setInterval(processOutbox, 5000);
  logger.info('[Outbox] Post event publisher worker started');

  let isOutboxCleanupRunning = false;

  setInterval(
    async () => {
      // Prevent overlapping cleanup jobs during slow database operations.
      if (isOutboxCleanupRunning) return;

      isOutboxCleanupRunning = true;

      try {
        await outboxWorker.cleanupPublishedEvents();
      } catch (error) {
        logger.error({ error }, 'Post outbox cleanup failed');
      } finally {
        isOutboxCleanupRunning = false;
      }
    },
    24 * 60 * 60 * 1000,
  );

  logger.info('[Outbox] Post event cleanup worker started');
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

    logger.info({ runtimeRole }, 'Post service runtime started');
  } catch (err) {
    logger.error({ err }, 'Failed to start post-service');
    process.exit(1);
  }
}

bootstrap();
