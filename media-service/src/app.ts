import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mediaRouter from './routes/media.routes.js';
import globalErrorHandler from './middlewares/globalErrorHandler.middleware.js';
import notFoundHandler from './middlewares/notFoundHandler.middleware.js';
import { metricsHandler, metricsMiddleware } from './monitoring/metrics.js';
import MediaController from './controllers/media.controller.js';
import MediaService from './services/media.service.js';
import MediaRespository from './repositories/media.repository.js';

export async function createApp() {
  const app = express();

  const mediaRepository = new MediaRespository();
  const mediaService = new MediaService(mediaRepository);
  const mediaController = new MediaController(mediaService);

  const allowedOrigins = ['http://localhost:3000'];

  app.use(helmet());
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.use(cookieParser());
  app.use(metricsMiddleware);

  app.get('/metrics', metricsHandler);

  app.use('/api/media', mediaRouter(mediaController));

  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}
