import client from 'prom-client';
import { NextFunction, Request, Response } from 'express';
import { registerGatewayMetrics } from './gateway.metrics.js';

const register = new client.Registry();

register.setDefaultLabels({
  service: 'web-gateway',
});

client.collectDefaultMetrics({ register });

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests received by web-gateway',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds for web-gateway',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

const routeLabelForPath = (path: string) => {
  if (path.startsWith('/api/social-graph')) return '/api/social-graph';
  if (path.startsWith('/api/users')) return '/api/users';
  if (path.startsWith('/api/user')) return '/api/user';
  if (path.startsWith('/api/auth')) return '/api/auth';
  if (path.startsWith('/api/media')) return '/api/media';
  if (path.startsWith('/api/posts')) return '/api/posts';
  if (path.startsWith('/api/chat')) return '/api/chat';
  if (path === '/metrics') return '/metrics';
  if (path === '/health') return '/health';

  return 'unmatched';
};

registerGatewayMetrics(register);

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const end = httpRequestDurationSeconds.startTimer();

  res.on('finish', () => {
    const labels = {
      method: req.method,
      route: routeLabelForPath(req.path),
      status_code: String(res.statusCode),
    };

    httpRequestsTotal.inc(labels);
    end(labels);
  });

  next();
}

export async function metricsHandler(_req: Request, res: Response) {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}
