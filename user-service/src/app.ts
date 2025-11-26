import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import globalErrorHandler from "./middlewares/globalErrorHandler.middleware.js";
import notFoundHandler from "./middlewares/notFoundHandler.middleware.js";
import { PrismaClient } from "./generated/prisma/client.js";
import { UserRepository } from "./repositories/user.repository.js";
import { UserService } from "./services/user.service.js";
import { UserController } from "./controllers/user.controllers.js";
import userRoutes from "./routes/user.routes.js";
import { connectRabbitMQ } from "./utils/rabbitmq.js";
import { metricsHandler, metricsMiddleware } from "./monitoring/metrics.js";

export async function createApp() {
  
  // 1. Create PrismaClient once per service
  const prisma = new PrismaClient();
  // 2. Create repository with injected Prisma
  const userRepository = new UserRepository(prisma);
  // 3. Create service with injected repo
  const userService = new UserService(userRepository);
  // 4. Create controller with injected service
  const userController = new UserController(userService);

  // connect to rabbitmq
  await connectRabbitMQ()

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

  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}
