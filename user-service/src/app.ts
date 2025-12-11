import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import globalErrorHandler from "./middlewares/globalErrorHandler.middleware.js";
import notFoundHandler from "./middlewares/notFoundHandler.middleware.js";
import { UserRepository } from "./modules/user/user.repository.js";
import { UserService } from "./modules/user/user.service.js";
import { UserController } from "./modules/user/user.controllers.js";
import userRoutes from "./modules/user/user.routes.js";
import { metricsHandler, metricsMiddleware } from "./monitoring/metrics.js";
import prisma from "./config/prismaClient.js";
import getKafkaProducer from "./utils/getKafkaProducer.js";
import { UserEventPublisher } from "./events/producers.js";
import authRoutes from "./modules/auth/auth.routes.js";
import { AuthRepository } from "./modules/auth/auth.repository.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { AuthController } from "./modules/auth/auth.controllers.js";
import getKafkaConsumer from "./utils/getKafkaConsumer.js";
import UserEventConsumer from "./events/consumers.js";
import logger from "./utils/logger.js";

export async function createApp() {
  
  // Initialize Kafka producer & consumer (singletons)
  const producer = await getKafkaProducer();
  const consumer = await getKafkaConsumer();

   // Initialize event consumer (inject singleton Kafka producer)
  const userEventPublisher = new UserEventPublisher(producer);

  // Initialize repositories with injected Prisma
  const userRepository = new UserRepository(prisma);
  const authRepository = new AuthRepository(prisma);
  
  //  Initialize services
  const userService = new UserService(userRepository, userEventPublisher);
  const authService = new AuthService(authRepository);

  // Initialize event consumer (inject Kafka consumer + userService)
  const userEventConsumer = new UserEventConsumer(consumer, userService);
  // Start Kafka consumer for inbound events
  try {
    await userEventConsumer.start();
    logger.info("[Kafka] UserEventConsumer started successfully");
  } catch (error) {
    logger.error(
      { error },
      "[Kafka] Failed to start UserEventConsumer"
    );
    // Optionally: process.exit(1);
  }

  // Initialize controllers
  const userController = new UserController(userService);
  const authControllers = new AuthController(authService);

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

  app.use("/api/user", userRoutes(userController));
  app.use("/api/auth", authRoutes(authControllers));

  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}
