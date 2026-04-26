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

import getKafkaProducer from './utils/kafka/getKafkaProducer.js';
import getUserKafkaConsumer from './utils/kafka/getUserKafkaConsumer.js';
import UserEventConsumer from './events/consumers/user-event.consumer.js';
import { OutboxWorker } from './workers/outbox.worker.js';

export const createApp = async () => {
  const producer = await getKafkaProducer();
  const userKafkaConsumer = await getUserKafkaConsumer();

  const socialGraphRepository = new SocialGraphRepository(prisma);
  const socialGraphEventPublisher = new SocialGraphEventPublisher(producer);
  const socialGraphService = new SocialGraphService(socialGraphRepository);
  const socialGraphController = new SocialGraphController(socialGraphService);
  const userEventConsumer = new UserEventConsumer(userKafkaConsumer, producer, socialGraphService);
  const outboxWorker = new OutboxWorker(prisma, socialGraphEventPublisher);

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

  return {
    app,
    userEventConsumer,
    outboxWorker
  };
};
