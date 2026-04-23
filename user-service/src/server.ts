import { createApp } from "./app.js";
import config from "./config/config.js";
import { initRedis } from "./config/redisClient.js";
import createKafkaTopic from "./utils/kafka/createKafkaTopic.js";
import logger from "./utils/logger.js";

const PORT = config.port;

async function bootstrap() {
  try {
    // 1. Init external dependencies first
    await initRedis();
    await createKafkaTopic();

    // 2. Create app and Kafka consumer
    const { app, socialGraphEventConsumer } = await createApp();

    // 3. Start Kafka consumer
    await socialGraphEventConsumer.start();
    logger.info('[Kafka] UserEventConsumer started');

    // 4. Start HTTP server
    app.listen(PORT, () => {
      logger.info(`social graph service is listening at ${PORT}`);
    });
  } catch (err) {
    logger.error({ err }, '❌ Failed to start social-graph-service');
    process.exit(1);
  }
}

bootstrap();
