// Central Prometheus metrics registry for monitoring HTTP, business, and infra events
import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';
import config from '../config/config.js';

export const register = new client.Registry();

register.setDefaultLabels({
  service: config.serviceName || 'user-service',
});

client.collectDefaultMetrics({ register });

// Normalize dynamic routes to prevent high-cardinality metrics
const normalizeRoute = (path: string): string => {
  return path
    .replace(/\/+/g, '/')
    .replace(/\/[0-9a-fA-F]{24}(?=\/|$)/g, '/:id')
    .replace(/\/[0-9a-fA-F-]{36}(?=\/|$)/g, '/:id')
    .replace(/\/[^/]*\d[^/]*(?=\/|$)/g, '/:id');
};

// Extract route label safely
const getRouteLabel = (req: Request): string => {
  if (req.route?.path) {
    return `${req.baseUrl}${req.route.path}` || req.path;
  }
  return normalizeRoute(req.path || 'unknown');
};

// Tracks total HTTP requests
export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// Tracks HTTP request duration (latency)
export const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

// Tracks login attempts by result and reason
export const authLoginAttemptsTotal = new client.Counter({
  name: 'auth_login_attempts_total',
  help: 'Total number of login attempts grouped by result and reason',
  labelNames: ['result', 'reason'],
});

// Tracks successful user creation
export const userCreatedCounter = new client.Counter({
  name: 'user_created_total',
  help: 'Total number of users successfully created',
});

// Tracks user updates by type
export const userUpdatedCounter = new client.Counter({
  name: 'user_updated_total',
  help: 'Total number of users successfully updated',
  labelNames: ['update_type'],
});

// Tracks profile reads by lookup type and result
export const userProfileReadsTotal = new client.Counter({
  name: 'user_profile_reads_total',
  help: 'Total number of user profile reads grouped by lookup type and result',
  labelNames: ['lookup_type', 'result'],
});

// Tracks Redis cache operations
export const redisCacheOperationsTotal = new client.Counter({
  name: 'redis_cache_operations_total',
  help: 'Total number of Redis cache operations grouped by operation and result',
  labelNames: ['operation', 'result'],
});

// Tracks Kafka messages published
export const kafkaMessagesPublishedTotal = new client.Counter({
  name: 'kafka_messages_published_total',
  help: 'Total number of Kafka messages successfully published',
  labelNames: ['topic', 'event_name'],
});

// Tracks Kafka publish failures
export const kafkaPublishFailuresTotal = new client.Counter({
  name: 'kafka_publish_failures_total',
  help: 'Total number of Kafka publish failures',
  labelNames: ['topic', 'event_name'],
});

// Tracks Kafka messages consumed
export const kafkaMessagesConsumedTotal = new client.Counter({
  name: 'kafka_messages_consumed_total',
  help: 'Total number of Kafka messages consumed',
  labelNames: ['topic', 'event_name'],
});

// Tracks Kafka consumer processing failures
export const kafkaConsumerFailuresTotal = new client.Counter({
  name: 'kafka_consumer_failures_total',
  help: 'Total number of Kafka consumer processing failures',
  labelNames: ['topic', 'reason'],
});

// Tracks messages sent to DLQ
export const kafkaDlqMessagesTotal = new client.Counter({
  name: 'kafka_dlq_messages_total',
  help: 'Total number of Kafka messages sent to DLQ',
  labelNames: ['source_topic', 'dlq_topic', 'reason'],
});

// Tracks Kafka offset commit failures
export const kafkaOffsetCommitFailuresTotal = new client.Counter({
  name: 'kafka_offset_commit_failures_total',
  help: 'Total number of Kafka offset commit failures',
  labelNames: ['topic'],
});

// Tracks outbox events claimed
export const outboxEventsClaimedTotal = new client.Counter({
  name: 'outbox_events_claimed_total',
  help: 'Total number of outbox events claimed for processing',
  labelNames: ['event_name'],
});

// Tracks outbox events published
export const outboxEventsPublishedTotal = new client.Counter({
  name: 'outbox_events_published_total',
  help: 'Total number of outbox events successfully published',
  labelNames: ['event_name'],
});

// Tracks outbox publish failures
export const outboxPublishFailuresTotal = new client.Counter({
  name: 'outbox_publish_failures_total',
  help: 'Total number of outbox event publish failures',
  labelNames: ['event_name'],
});

// Tracks pending outbox events (real-time)
export const outboxPendingEventsGauge = new client.Gauge({
  name: 'outbox_pending_events',
  help: 'Number of outbox events waiting to be published',
});

// Tracks cleanup of old outbox events
export const outboxCleanupDeletedTotal = new client.Counter({
  name: 'outbox_cleanup_deleted_total',
  help: 'Total number of old published outbox events deleted',
});

// Register all metrics
register.registerMetric(httpRequestsTotal);
register.registerMetric(httpRequestDurationSeconds);
register.registerMetric(authLoginAttemptsTotal);
register.registerMetric(userCreatedCounter);
register.registerMetric(userUpdatedCounter);
register.registerMetric(userProfileReadsTotal);
register.registerMetric(redisCacheOperationsTotal);
register.registerMetric(kafkaMessagesPublishedTotal);
register.registerMetric(kafkaPublishFailuresTotal);
register.registerMetric(kafkaMessagesConsumedTotal);
register.registerMetric(kafkaConsumerFailuresTotal);
register.registerMetric(kafkaDlqMessagesTotal);
register.registerMetric(kafkaOffsetCommitFailuresTotal);
register.registerMetric(outboxEventsClaimedTotal);
register.registerMetric(outboxEventsPublishedTotal);
register.registerMetric(outboxPublishFailuresTotal);
register.registerMetric(outboxPendingEventsGauge);
register.registerMetric(outboxCleanupDeletedTotal);

// Middleware to record HTTP metrics
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
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

// Prometheus scrape endpoint
export const metricsHandler = async (_req: Request, res: Response) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
};
