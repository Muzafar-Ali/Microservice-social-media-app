import { createApp } from './app.js';
import { initRedis } from './config/redisClient.js';
import createKafkaTopic from './utils/kafka/createKafkaTopic.js';
import logger from './utils/logger.js';

const PORT = process.env.PORT || 4002;

async function bootstrap() {
  try {
    await initRedis();
    await createKafkaTopic();

    const app = await createApp();

    app.listen(PORT, () => {
      logger.info(`app is listening at ${PORT}`);
    });
  } catch (err) {
    logger.error({err}, '❌ Failed to start app');
    process.exit(1);
  }
}

bootstrap();
