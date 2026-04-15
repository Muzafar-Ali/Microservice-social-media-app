import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import socialGrpahRoutes from './routes/socialGraph.routes.js';
import globalErrorHandler from './middlewares/globalErrorHandler.middleware.js';
import notFoundHandler from './middlewares/notFoundHandler.middleware.js';
import { SocialGraphRepository } from './repository/socialGraph.repository.js';
import { SocialGraphEventPublisher } from './events/socialGraph-producer.js';
import { SocialGraphService } from './services/socialGraph.service.ts.js';
import { SocialGraphController } from './contorllers/socialGraph.controllers.js';
import prisma from './config/prismaClinet.js';
import getKafkaProducer from './utils/getKafkaProducer.js';
import getKafkaConsumer from './utils/getKafkaConsumer.js';

export const createApp = async () => {
  const producer = await getKafkaProducer();
  const consumer = await getKafkaConsumer();

  const socialGraphRepository = new SocialGraphRepository(prisma);
  const socialGraphEventPublisher = new SocialGraphEventPublisher(producer);
  const socialGraphService = new SocialGraphService(
    socialGraphRepository,
    socialGraphEventPublisher,
  );
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

  app.use('/api/social-graph', socialGrpahRoutes(socialGraphController));

  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return {
    app,
  };
};
