import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import globalErrorHandler from './middlewares/globalErrorHandler.middleware.js';
import notFoundHandler from './middlewares/notFoundHandler.middleware.js';
import { metricsHandler, metricsMiddleware } from './monitoring/metrics.js';
import postRoutes from './routes/post.routes.js';
import { PostRepository } from './repositories/post.repository.js';
import { PostService } from './services/post.service.js';
import { PostController } from './controllers/post.controller.js';
import prisma from './config/prismaClient.js';
import config from './config/config.js';

export async function createApp() {
  const postRepository = new PostRepository(prisma);
  const postService = new PostService(postRepository);
  const postController = new PostController(postService);

  const app = express();

  app.use(helmet());
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin || config.corsAllowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error('Not allowed by CORS'));
      },
    }),
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.use(metricsMiddleware);

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: config.serviceName,
    });
  });

  app.get('/ready', async (_req, res, next) => {
    try {
      await prisma.$queryRaw`SELECT 1`;

      res.status(200).json({
        status: 'ready',
        service: config.serviceName,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/metrics', metricsHandler);

  app.use('/api/posts', postRoutes(postController));

  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}
