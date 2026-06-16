import client from 'prom-client';

export const outboxEventsCreatedTotal = new client.Counter({
  name: 'outbox_events_created_total',
  help: 'Total number of outbox events created',
  labelNames: ['event_name', 'result'],
});

export const outboxEventsClaimedTotal = new client.Counter({
  name: 'outbox_events_claimed_total',
  help: 'Total number of outbox events claimed for processing',
  labelNames: ['event_name'],
});

export const outboxEventsPublishedTotal = new client.Counter({
  name: 'outbox_events_published_total',
  help: 'Total number of outbox events successfully published',
  labelNames: ['event_name'],
});

export const outboxPublishFailuresTotal = new client.Counter({
  name: 'outbox_publish_failures_total',
  help: 'Total number of outbox event publish failures',
  labelNames: ['event_name'],
});

export const outboxEventsDeadLetteredTotal = new client.Counter({
  name: 'outbox_events_dead_lettered_total',
  help: 'Total number of outbox events moved to dead-letter state',
  labelNames: ['event_name'],
});

export const outboxPendingEventsGauge = new client.Gauge({
  name: 'outbox_pending_events',
  help: 'Number of outbox events waiting to be published',
});

export const outboxDeadLetteredEventsGauge = new client.Gauge({
  name: 'outbox_dead_lettered_events',
  help: 'Number of outbox events currently in dead-letter state',
});

export const outboxCleanupDeletedTotal = new client.Counter({
  name: 'outbox_cleanup_deleted_total',
  help: 'Total number of old published outbox events deleted',
});

export const registerOutboxMetrics = (register: client.Registry): void => {
  register.registerMetric(outboxEventsCreatedTotal);
  register.registerMetric(outboxEventsClaimedTotal);
  register.registerMetric(outboxEventsPublishedTotal);
  register.registerMetric(outboxPublishFailuresTotal);
  register.registerMetric(outboxEventsDeadLetteredTotal);
  register.registerMetric(outboxPendingEventsGauge);
  register.registerMetric(outboxDeadLetteredEventsGauge);
  register.registerMetric(outboxCleanupDeletedTotal);
};
