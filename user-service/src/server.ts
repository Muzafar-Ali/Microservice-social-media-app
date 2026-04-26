import { createApp } from './app.js';
import config from './config/config.js';
import { initRedis } from './config/redisClient.js';
import executeWithRetry from './utils/executeWithRetry.js';
import createKafkaTopic from './utils/kafka/createKafkaTopic.js';
import logger from './utils/logger.js';

const PORT = config.port;

async function bootstrap() {
  try {
    // 1. Init external dependencies first
    await initRedis();
    await executeWithRetry('Kafka topic creation', createKafkaTopic);

    // 2. Create app, Kafka consumer, and outbox worker
    const { app, socialGraphEventConsumer, outboxWorker } = await createApp();

    // 3. Start Kafka consumer
    await executeWithRetry('Kafka consumer start', () => socialGraphEventConsumer.start());
    logger.info('[Kafka] UserEventConsumer started');

    // 4. Start outbox event publisher worker
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

    // 5. Start published event cleanup worker
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

    // 6. Start HTTP server
    app.listen(PORT, () => {
      logger.info(`user-service is listening at ${PORT}`);
    });
  } catch (err) {
    logger.error({ err }, '❌ Failed to start user-service');
    process.exit(1);
  }
}

bootstrap();