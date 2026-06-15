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

    // 2. Create app and Kafka consumer
    const { app, userEventConsumer, mediaEventConsumer, socialGraphEventConsumer, outboxWorker } =
      await createApp();

    // 3. Start Kafka consumer
    await executeWithRetry('UserEventConsumer start', () => userEventConsumer.start());
    await executeWithRetry('MediaEventConsumer start', () => mediaEventConsumer.start());
    await executeWithRetry('SocialGraphEventConsumer start', () => socialGraphEventConsumer.start());

    // 4. Start outbox publisher without overlapping worker runs
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

    // 5. Start published-event cleanup without overlapping cleanup runs
    let isOutboxCleanupRunning = false;

    setInterval(
      async () => {
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

    // 6. Start HTTP server
    app.listen(PORT, () => {
      logger.info(`Post service is listening at ${PORT}`);
    });
  } catch (err) {
    logger.error({ err }, '❌ Failed to start post-service');
    process.exit(1);
  }
}

bootstrap();
