import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';
import config from '../config/config.js';
import { registerKafkaMetrics } from './kafka.metrics.js';
import { registerOutboxMetrics } from './outbox.metrics.js';

export const register = new client.Registry();

register.setDefaultLabels({
  service: config.serviceName || 'post-service',
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

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

export const postCreatedCounter = new client.Counter({
  name: 'post_created_total',
  help: 'Total number of posts successfully created',
});

export const postOperationsTotal = new client.Counter({
  name: 'post_operations_total',
  help: 'Total number of successful post lifecycle operations',
  labelNames: ['operation'],
});

export const postMediaItemsHistogram = new client.Histogram({
  name: 'post_media_items_per_post',
  help: 'Number of media items attached to successfully created posts',
  buckets: [0, 1, 2, 3, 5, 10],
});

export const feedRequestsTotal = new client.Counter({
  name: 'post_feed_requests_total',
  help: 'Total number of successful feed page reads',
  labelNames: ['feed_type'],
});

export const feedItemsReturnedHistogram = new client.Histogram({
  name: 'post_feed_items_returned',
  help: 'Number of items returned by feed page reads',
  labelNames: ['feed_type'],
  buckets: [0, 1, 5, 10, 20, 30, 50],
});

export const postEngagementActionsTotal = new client.Counter({
  name: 'post_engagement_actions_total',
  help: 'Total number of successful post engagement write actions',
  labelNames: ['action'],
});

register.registerMetric(httpRequestsTotal);
register.registerMetric(httpRequestDuration);
register.registerMetric(postCreatedCounter);
register.registerMetric(postOperationsTotal);
register.registerMetric(postMediaItemsHistogram);
register.registerMetric(feedRequestsTotal);
register.registerMetric(feedItemsReturnedHistogram);
register.registerMetric(postEngagementActionsTotal);
registerKafkaMetrics(register);
registerOutboxMetrics(register);

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const end = httpRequestDuration.startTimer();

  res.on('finish', () => {
    const labels = {
      method: req.method,
      route: getRouteLabel(req),
      status_code: String(res.statusCode),
    };

    httpRequestsTotal.inc(labels);
    end(labels);
  });

  next();
};

export const metricsHandler = async (_req: Request, res: Response) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
};
