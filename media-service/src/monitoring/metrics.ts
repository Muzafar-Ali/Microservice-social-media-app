import { NextFunction, Request, Response } from 'express';
import client from 'prom-client';
import config from '../config/config.js';
import { registerKafkaMetrics } from './kafka.metrics.js';
import { registerMediaMetrics } from './media.metrics.js';

export const register = new client.Registry();

register.setDefaultLabels({
  service: config.serviceName || 'media-service',
});

client.collectDefaultMetrics({ register });

const normalizeRoute = (path: string): string => {
  return path
    .replace(/\/+/g, '/')
    .replace(/\/[0-9a-fA-F]{24}(?=\/|$)/g, '/:id')
    .replace(/\/[0-9a-fA-F-]{36}(?=\/|$)/g, '/:id')
    .replace(/\/[^/]*\d[^/]*(?=\/|$)/g, '/:id');
};

const getRouteLabel = (req: Request): string => {
  if (req.route?.path) {
    return `${req.baseUrl}${req.route.path}` || req.path;
  }

  return normalizeRoute(req.path || 'unknown');
};

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

export const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

register.registerMetric(httpRequestsTotal);
register.registerMetric(httpRequestDurationSeconds);
registerKafkaMetrics(register);
registerMediaMetrics(register);

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const endTimer = httpRequestDurationSeconds.startTimer();

  res.on('finish', () => {
    const labels = {
      method: req.method,
      route: getRouteLabel(req),
      status_code: String(res.statusCode),
    };

    httpRequestsTotal.inc(labels);
    endTimer(labels);
  });

  next();
};

export const metricsHandler = async (_req: Request, res: Response): Promise<void> => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
};
