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
    const { app, userEventConsumer, mediaEventConsumer } = await createApp();

    // 3. Start Kafka consumer
    try {
      await userEventConsumer.start();
      logger.info("[Kafka] UserEventConsumer started");
    } catch (error) {
      logger.error({ error }, "[Kafka] Failed to start UserEventConsumer");
    }

    try {
      await mediaEventConsumer.start();
      logger.info("[Kafka] MediaEventConsumer started");
    } catch (error) {
      logger.error({ error }, "[Kafka] Failed to start MediaEventConsumer");
    }

    // 4. Start HTTP server
    app.listen(PORT, () => {
      logger.info(`Post service is listening at ${PORT}`);
    });

  } catch (err) {
    logger.error({ err }, "❌ Failed to start post-service");
    process.exit(1);
  }
}

bootstrap();