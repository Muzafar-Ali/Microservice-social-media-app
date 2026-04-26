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
    const { app, userEventConsumer, mediaEventConsumer } = await createApp();

    // 3. Start Kafka consumer
    await executeWithRetry('UserEventConsumer start', () => userEventConsumer.start());
    await executeWithRetry('MediaEventConsumer start', () => mediaEventConsumer.start());

    // 4. Start HTTP server
    app.listen(PORT, () => {
      logger.info(`Post service is listening at ${PORT}`);
    });
  } catch (err) {
    logger.error({ err }, '❌ Failed to start post-service');
    process.exit(1);
  }
}

bootstrap();
