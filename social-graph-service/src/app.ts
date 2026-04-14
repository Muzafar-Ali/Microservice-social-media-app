import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import socialGrpahRoutes from "./routes/social-graph.routes.js";
import globalErrorHandler from "./middlewares/globalErrorHandler.middleware.js";
import notFoundHandler from "./middlewares/notFoundHandler.middleware.js";

export const createApp = async() => {

  const app = express();

  const allowedOrigins = [""];

  app.use(helmet());
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true
    })
  );


  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // app.use(metricsMiddleware);

  app.get("/health", (_req, res) => {
    res.send("social graps service Health is ok");
  });

  app.use("/api/social-graph", socialGrpahRoutes());

  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return {
    app
  };
}