import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import globalErrorHandler from "./middlewares/globalErrorHandler.middleware.js";
import notFoundHandler from "./middlewares/notFoundHandler.middleware.js";
import { metricsHandler, metricsMiddleware } from "./monitoring/metrics.js"; // Monitoring needs to be added later
import postRoutes from "./routes/post.routes.js";
import { PostRepository } from "./repositories/post.repository.js";
import { PostService } from "./services/post.service.js";
import { PostController } from "./controllers/post.controller.js";
import prisma from "./config/prismaClient.js";
import { PostEventPublisher } from "./events/post-events.producer.js";

import getUserKafkaConsumer from "./utils/kafka/getUserKafkaConsumer.js";
import getMediaKafkaConsumer from "./utils/kafka/getMediaKafkaConsumer.js";
import getKafkaProducer from "./utils/kafka/getKafkaProducer.js";
import UserEventConsumer from "./events/consumers/user-event.consumer.js";
import MediaEventConsumer from "./events/consumers/media-event.consumer.js";



export async function createApp() {
  const producer = await getKafkaProducer();
  const userKafkaConsumer = await getUserKafkaConsumer();
  const mediaKafkaConsumer = await getMediaKafkaConsumer();

  const postRepository = new PostRepository(prisma);
  const postEventPublisher = new PostEventPublisher(producer);
  const postService = new PostService(postRepository, postEventPublisher); // Producer might be used in service for events
  const postController = new PostController(postService);
  const userEventConsumer = new UserEventConsumer(userKafkaConsumer, producer, postService);
  const mediaEventConsumer = new MediaEventConsumer(mediaKafkaConsumer, producer, postService);

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

  return {
    app,
    userEventConsumer,
    mediaEventConsumer
  }
}
