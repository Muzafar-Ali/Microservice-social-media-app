import { createApp } from './app.js';
import config from './config/config.js';

const PORT = config.port;

async function bootstrap() {
  try {
    // await initRedis();
    const { app } = await createApp();

    // try {
    //   await postEventConsumer.start();
    //   console.log("[Kafka] PostEventConsumer started");
    // } catch (error) {
    //   console.error("[Kafka] Failed to start PostEventConsumer", error);
    // }

    app.listen(PORT, () => {
      console.log(`Social graph service is listening at ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start social-graph-service', err);
    process.exit(1);
  }
}

bootstrap();
