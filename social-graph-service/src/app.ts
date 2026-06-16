import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import socialGraphRoutes from './routes/socialGraph.routes.js';
import globalErrorHandler from './middlewares/globalErrorHandler.middleware.js';
import notFoundHandler from './middlewares/notFoundHandler.middleware.js';
import { SocialGraphRepository } from './repository/socialGraph.repository.js';
import { SocialGraphEventPublisher } from './events/socialGraph-producer.js';
import { SocialGraphService } from './services/socialGraph.service.js';
import { SocialGraphController } from './controllers/socialGraph.controllers.js';
import prisma from './config/prismaClient.js';

export const createApp = async () => {
  const socialGraphRepository = new SocialGraphRepository(prisma);
  const socialGraphService = new SocialGraphService(socialGraphRepository);
  const socialGraphController = new SocialGraphController(socialGraphService);

  const app = express();

  const allowedOrigins = [''];

  app.use(helmet());
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    }),
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // app.use(metricsMiddleware);

  app.get('/health', (_req, res) => {
    res.send('social graps service Health is ok');
  });

  app.use('/api/social-graph', socialGraphRoutes(socialGraphController));

  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
};
