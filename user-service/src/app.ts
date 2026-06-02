import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import globalErrorHandler from './middlewares/globalErrorHandler.middleware.js';
import notFoundHandler from './middlewares/notFoundHandler.middleware.js';
import { UserRepository } from './modules/user/user.repository.js';
import { UserService } from './modules/user/user.service.js';
import { UserController } from './modules/user/user.controllers.js';
import userRoutes from './modules/user/user.routes.js';
import { metricsHandler, metricsMiddleware } from './monitoring/metrics.js';
import prisma from './config/prismaClient.js';
import getKafkaProducer from './utils/kafka/getKafkaProducer.js';
import { UserEventPublisher } from './events/producers.js';
import authRoutes from './modules/auth/auth.routes.js';
import { AuthRepository } from './modules/auth/auth.repository.js';
import { AuthService } from './modules/auth/auth.service.js';
import { AuthController } from './modules/auth/auth.controllers.js';
import getSocialGraphKafkaConsumer from './utils/kafka/getSocialGraphKafkaConsumer.js';
import { SocialGraphEventConsumer } from './events/consumers/social-graph-event-consumer.js';
import { OutboxWorker } from './modules/user/user.outboxWorker.js';
import { redis } from './config/redisClient.js';

export async function createApp() {
  const producer = await getKafkaProducer();
  const socialGraphKafkaConsumer = await getSocialGraphKafkaConsumer();

  const userEventPublisher = new UserEventPublisher(producer);
  const userRepository = new UserRepository(prisma);
  const authRepository = new AuthRepository(prisma);
  const userService = new UserService(userRepository);
  const authService = new AuthService(authRepository);
  const userController = new UserController(userService);
  const authControllers = new AuthController(authService);
  const socialGraphEventConsumer = new SocialGraphEventConsumer(socialGraphKafkaConsumer, producer, userService);
  const outboxWorker = new OutboxWorker(prisma, userEventPublisher);

  const app = express();

  const allowedOrigins = ['http://localhost:3000'];

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

  app.use(metricsMiddleware);

  // Kubernetes liveness probe
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'user-service',
    });
  });

  // Kubernetes readiness probe
  app.get('/ready', async (_req, res) => {
    const checks = {
      postgres: false,
      redis: false,
    };

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.postgres = true;
    } catch {
      checks.postgres = false;
    }

    try {
      await redis.ping();
      checks.redis = true;
    } catch {
      checks.redis = false;
    }

    const ready = Object.values(checks).every(Boolean);

    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      service: 'user-service',
      checks,
    });
  });

  // expose /metrics for Prometheus
  app.get('/metrics', metricsHandler);

  app.use('/api/user', userRoutes(userController));
  app.use('/api/users', userRoutes(userController));
  app.use('/api/auth', authRoutes(authControllers));

  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return {
    app,
    socialGraphEventConsumer,
    outboxWorker,
  };
}
