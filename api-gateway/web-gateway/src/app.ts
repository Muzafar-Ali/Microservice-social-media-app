import './observability/instrumentation.js';
import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import config from './config/config.js';
import logger from './utils/logger.js';
import { metricsHandler, metricsMiddleware } from './monitoring/metrics.js';
import { gatewayProxyRequestsTotal } from './monitoring/gateway.metrics.js';

const app = express();

app.use(
  cors({
    origin: config.corsAllowedOrigins,
    credentials: true,
  }),
);

app.use(metricsMiddleware);

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'web-gateway',
  });
});

app.get('/metrics', metricsHandler);

const createObservedProxy = (routePrefix: string, target: string, targetService: string) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: (path, _req) => `${routePrefix}${path}`,
    on: {
      proxyReq: (proxyReq, req: any) => {
        logger.info(
          {
            method: req.method,
            originalUrl: req.originalUrl,
            targetService,
            target,
            upstreamPath: proxyReq.path,
          },
          'gateway proxy request',
        );
      },
      proxyRes: (proxyRes, req: any) => {
        gatewayProxyRequestsTotal.inc({
          target_service: targetService,
          route: routePrefix,
          result: 'success',
          status_code: String(proxyRes.statusCode ?? 0),
        });

        logger.info(
          {
            method: req.method,
            originalUrl: req.originalUrl,
            targetService,
            statusCode: proxyRes.statusCode,
          },
          'gateway proxy response',
        );
      },
      error: (err, req, res: any) => {
        const request = req as any;

        gatewayProxyRequestsTotal.inc({
          target_service: targetService,
          route: routePrefix,
          result: 'failure',
          status_code: '502',
        });

        logger.error(
          {
            method: request.method,
            originalUrl: request.originalUrl,
            targetService,
            target,
            error: err.message,
            code: (err as NodeJS.ErrnoException).code,
          },
          'gateway proxy error',
        );

        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
        }

        res.end(
          JSON.stringify({
            success: false,
            message: `${targetService} proxy failed`,
            error: err.message,
            code: (err as NodeJS.ErrnoException).code ?? 'UNKNOWN',
          }),
        );
      },
    },
  });

// Route: /api/user/* -> user-service/*
app.use('/api/user', createObservedProxy('/api/user', config.userServiceUrl, 'user-service'));

// Route: /api/users/* -> user-service/*
app.use('/api/users', createObservedProxy('/api/users', config.userServiceUrl, 'user-service'));

// Route: /api/auth/* -> user-service/*
app.use('/api/auth', createObservedProxy('/api/auth', config.userServiceUrl, 'user-service'));

// Route: /api/media/* -> media-service/*
app.use('/api/media', createObservedProxy('/api/media', config.mediaServiceUrl, 'media-service'));

// Route: /api/posts/* -> post-service/*
app.use('/api/posts', createObservedProxy('/api/posts', config.postServiceLUrl, 'post-service'));

// Route: /api/chat/* -> chat-service/*
app.use('/api/chat', createObservedProxy('/api/chat', config.chatServiceUrl, 'chat-service'));

// Route: /api/social-graph/* -> social graph service/*
app.use(
  '/api/social-graph',
  createObservedProxy('/api/social-graph', config.socialGraphServiceUrl, 'social-graph-service'),
);

const port = Number(process.env.PORT ?? 8088);

const server = app.listen(port, () => {
  logger.info({ port }, `[web-gateway] listening on http://localhost:${port}`);
});

function gracefulShutdown(signal: string) {
  logger.info({ signal }, '[web-gateway] shutting down gracefully');

  server.close(() => {
    logger.info('[web-gateway] all connections closed');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('[web-gateway] force shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
