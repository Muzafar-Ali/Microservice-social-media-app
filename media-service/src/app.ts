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

export async function createApp() {

  const app = express();

  // const producer = await getKafkaProducer();
  const mediaRepository = new MediaRespository();
  const mediaService = new MediaService(mediaRepository);
  const mediaController = new MediaController(mediaService);

  const allowedOrigins = ["localhost:4001"]

  app.use(helmet());
  app.use(cors({
    origin: allowedOrigins,
    credentials: true
  }))

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }))

  app.use(cookieParser());

  app.use("/media", mediaRouter(mediaController));

  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}
