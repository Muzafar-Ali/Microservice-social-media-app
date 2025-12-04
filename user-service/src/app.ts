import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import globalErrorHandler from "./middlewares/globalErrorHandler.middleware.js";
import notFoundHandler from "./middlewares/notFoundHandler.middleware.js";
import { PrismaClient } from "./generated/prisma/client.js";
import { UserRepository } from "./modules/user/user.repository.js";
import { UserService } from "./modules/user/user.service.js";
import { UserController } from "./modules/user/user.controllers.js";
import userRoutes from "./modules/user/user.routes.js";
import { connectRabbitMQ } from "./utils/rabbitmq.js";
import { metricsHandler, metricsMiddleware } from "./monitoring/metrics.js";
import authRoutes from "./modules/auth/auth.routes.js";
import { AuthRepository } from "./modules/auth/auth.repository.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { AuthController } from "./modules/auth/auth.controllers.js";
import config from "./config/config.js";
import prisma from "./config/prismaClient.js";
import { getKafkaProducer } from "./utils/getKafkaProducer.js";
import { UserEventPublisher } from "./events/producers.js";

export async function createApp() {
  
  // Get the singleton Kafka producer (connects only once)
  const producer = await getKafkaProducer();

  // Create repository with injected Prisma
  const userRepository = new UserRepository(prisma);
  // Initialize event publisher by injecting the singleton Kafka producer
  const userEventPublisher = new UserEventPublisher(producer);
  // Create service with injected repo
  const userService = new UserService(userRepository, userEventPublisher);
  // Create controller with injected service
  const userController = new UserController(userService);

  const app = express();

  const allowedOrigins = ["http://localhost:3000"];

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

  // expose /metrics for Prometheus
  app.get("/metrics", metricsHandler);

  app.use("/api/users", userRoutes(userController));
    app.use("/api/auth", authRoutes(authController));

  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}
