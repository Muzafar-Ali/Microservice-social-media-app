import { createApp } from "./app.js";
import config from "./config/config.js";
import { initRedis } from "./config/redisClient.js";
// import { initRedis } from "./config/redisClient.js";

const PORT = config.port;

async function bootstrap() {
  try {
    await initRedis();
    const app = await createApp();

    app.listen(PORT, () => {
      console.log(`Post service is listening at ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start post-service", err);
    process.exit(1);
  }
}

bootstrap();
