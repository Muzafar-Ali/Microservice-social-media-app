import client from 'prom-client';

export const userCreatedTotal = new client.Counter({
  name: 'user_created_total',
  help: 'Total user creation attempts',
  labelNames: ['result', 'reason'],
});

export const userUpdatedTotal = new client.Counter({
  name: 'user_updated_total',
  help: 'Total user update attempts',
  labelNames: ['update_type', 'result', 'reason'],
});

export const userStatusChangesTotal = new client.Counter({
  name: 'user_status_changes_total',
  help: 'Total user status change attempts',
  labelNames: ['from_status', 'to_status', 'result'],
});

export const userProfileReadsTotal = new client.Counter({
  name: 'user_profile_reads_total',
  help: 'Total number of user profile reads grouped by lookup type and result',
  labelNames: ['lookup_type', 'result'],
});

export const userFollowProjectionEventsTotal = new client.Counter({
  name: 'user_follow_projection_events_total',
  help: 'Total follow projection events processed by user service',
  labelNames: ['event_type', 'result'],
});

export const userServiceOperationDurationSeconds = new client.Histogram({
  name: 'user_service_operation_duration_seconds',
  help: 'User service operation duration in seconds',
  labelNames: ['operation', 'result'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

export const registerUserMetrics = (register: client.Registry): void => {
  register.registerMetric(userCreatedTotal);
  register.registerMetric(userUpdatedTotal);
  register.registerMetric(userStatusChangesTotal);
  register.registerMetric(userProfileReadsTotal);
  register.registerMetric(userFollowProjectionEventsTotal);
  register.registerMetric(userServiceOperationDurationSeconds);
};