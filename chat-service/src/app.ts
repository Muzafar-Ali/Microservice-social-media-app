import express from "express";
import helmet from "helmet";
import cors from 'cors';
import cookieParser from "cookie-parser";
import globalErrorHandler from "./middlewares/globalErrorHandler.middleware";
import notFoundHandler from "./middlewares/notFoundHandler.middleware";

const createApp = () => {

  const app = express()
  
  const allowedOrigins = ["http://localhost:3000"];
  
  app.use(cors({
    origin: allowedOrigins,
    credentials: true
  }))
  app.options("*", cors());
  app.use(helmet());
  
  app.use(express.json());
  app.use(express.urlencoded({extended: true}));
  
  app.use(cookieParser());
  
  app.use("api/chat");
  
  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}