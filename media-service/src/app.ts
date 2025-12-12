import express, { json } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import mediaRouter from "./routes/media.routes";
import globalErrorHandler from "./middlewares/globalErrorHandler.middleware";
import notFoundHandler from "./middlewares/notFoundHandler.middleware";
import MediaController from "./controllers/media.controller";
import MediaService from "./services/media.service";
import MediaRespository from "./respositories/media.respository";
import config from "./config/config";
import getKafkaProducer from "./utils/getKafkaProducer";
import MediaServiceEventPublisher from "./events/producer";

export async function createApp() {

  const app = express();

  const producer = await getKafkaProducer();
  const mediaServiceEventPublisher = new MediaServiceEventPublisher(producer);
  const mediaRepository = new MediaRespository();
  const mediaService = new MediaService(mediaRepository, mediaServiceEventPublisher);
  const mediaController = new MediaController(mediaService);

  const allowedOrigins = ["http://localhost:3000"]; 

  app.use(helmet());
  app.use(cors({
    origin: allowedOrigins,
    credentials: true
  }))
  console.log("logs", config.cloudinaryApiKey, config.cloudinaryApiSecret, config.cloudinaryCloudName);
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }))

  app.use(cookieParser());

  app.use("/api/media", mediaRouter(mediaController));

  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}
