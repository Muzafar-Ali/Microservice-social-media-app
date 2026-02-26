import express from "express";
import helmet from "helmet";
import cors from 'cors';
import cookieParser from "cookie-parser";
import { ChatRepository } from "./respositories/chat.repository.js";
import { ChatService } from "./services/chat.service.js";
import { ChatController } from "./controllers/chat.controllers.js";
import chatRoutes from "./routes/chat.routes.js";
import { metricsHandler, metricsMiddleware } from "./monitoring/metrics.js";
import notFoundHandler from "./middlewares/notFoundHandler.middleware.js";
import globalErrorHandler from "./middlewares/globalErrorHandler.middleware.js";
import prisma from "./config/prismaClient.js";

export const createApp = () => {

  const chatRepository = new ChatRepository(prisma);
  const chatService = new ChatService(chatRepository);
  const chatController = new ChatController(chatService);

  const app = express()
  
  const allowedOrigins = ["http://localhost:3000"];
  
  app.use(cors({
    origin: allowedOrigins,
    credentials: true
  }))
  // app.options("*", cors());
  app.use(helmet());
  
  app.use(express.json());
  app.use(express.urlencoded({extended: true}));
  
  app.use(cookieParser());
   app.use(metricsMiddleware);

  app.get("/metrics", metricsHandler);
  app.use("/api/chat", chatRoutes(chatController));
  
  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return { app, chatService };
}