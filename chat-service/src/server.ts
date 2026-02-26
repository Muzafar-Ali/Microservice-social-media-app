import { createApp } from "./app.js";
import { initRedis } from "./config/redisClient.js";
import http from "http"
import { initSocketServer } from "./socket/index.js";
import config from "./config/config.js";
import logger from "./utils/logger.js";

async function bootstrap() {
  try {
    await initRedis();

    const { app, chatService } = await createApp();
    const httpServer = http.createServer(app);

    // Socket.IO attaches to the same HTTP server.
    initSocketServer(httpServer, chatService);

    httpServer.listen(config.port, () => {
      logger.info(`[chat-service] listening on http://localhost:${config.port}`);
    });
  } catch (error) {
    logger.error({ error }, "❌ Failed to start chat-service");
    process.exit(1);
  }
}

bootstrap();