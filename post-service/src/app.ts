import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import globalErrorHandler from "./middlewares/globalErrorHandler.middleware.js";
import notFoundHandler from "./middlewares/notFoundHandler.middleware.js";
import { metricsHandler, metricsMiddleware } from "./monitoring/metrics.js"; // Monitoring needs to be added later
import getKafkaProducer from "./utils/getKafkaProducer.js";
import logger from "./utils/logger.js";
import postRoutes from "./routes/post.routes.js";
import { PostRepository } from "./repositories/post.repository.js";
import { PostService } from "./services/post.service.js";
import { PostController } from "./controllers/post.controller.js";
import prisma from "./config/prismaClient.js";

export async function createApp() {
  const producer = await getKafkaProducer();

  // Initialize repositories with injected Prisma
  const postRepository = new PostRepository(prisma);
  
  //  Initialize services
  const postService = new PostService(postRepository, producer); // Producer might be used in service for events

  // Initialize controllers
  const postController = new PostController(postService);

  const app = express();

  const allowedOrigins = ["http://localhost:3000"]; // This should come from config

  app.use(helmet());
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    })
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.use(metricsMiddleware);

  app.get("/health", (_req, res) => {
    res.send("Health is ok");
  });

  app.get("/metrics", metricsHandler);

  app.use("/api/posts", postRoutes(postController));

  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}
