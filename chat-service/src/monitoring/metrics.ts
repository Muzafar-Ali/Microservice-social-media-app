import client from 'prom-client';
import { Request, Response, NextFunction } from 'express';
import { registerChatMetrics } from './chat.metrics.js';

const register = new client.Registry();

register.setDefaultLabels({
  service: 'chat-service',
});

client.collectDefaultMetrics({ register });

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests received by chat-service',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds for chat-service',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

registerChatMetrics(register);

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const end = httpRequestDurationSeconds.startTimer();

  res.on('finish', () => {
    const route = (req.route?.path as string) || req.path;
    const labels = { method: req.method, route, status_code: String(res.statusCode) };

    httpRequestsTotal.inc(labels);
    end(labels);
  });

  next();
}

export async function metricsHandler(_req: Request, res: Response) {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}
