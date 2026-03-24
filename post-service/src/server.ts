import { createApp } from "./app.js";
import config from "./config/config.js";
import { initRedis } from "./config/redisClient.js";

const PORT = config.port;

async function bootstrap() {
  try {
    await initRedis();
    const { app, postEventConsumer } = await createApp();

    try {
      await postEventConsumer.start();
      console.log("[Kafka] PostEventConsumer started");
    } catch (error) {
      console.error("[Kafka] Failed to start PostEventConsumer", error);
    }

    app.listen(PORT, () => {
      console.log(`Post service is listening at ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start post-service", err);
    process.exit(1);
  }
}

bootstrap();
