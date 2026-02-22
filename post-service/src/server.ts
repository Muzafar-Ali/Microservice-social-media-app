import { createApp } from "./app.js";
// import { initRedis } from "./config/redisClient.js";

const PORT = process.env.PORT || 4003;

async function bootstrap() {
  try {
    // await initRedis();
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
