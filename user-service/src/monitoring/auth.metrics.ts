import client from 'prom-client';

export const authLoginAttemptsTotal = new client.Counter({
  name: 'auth_login_attempts_total',
  help: 'Total number of login attempts grouped by result and reason',
  labelNames: ['result', 'reason'],
});

export const passwordResetRequestsTotal = new client.Counter({
  name: 'password_reset_requests_total',
  help: 'Total password reset requests grouped by result',
  labelNames: ['result'],
});

export const passwordResetConfirmationsTotal = new client.Counter({
  name: 'password_reset_confirmations_total',
  help: 'Total password reset confirmations grouped by result',
  labelNames: ['result'],
});

export const passwordChangesTotal = new client.Counter({
  name: 'password_changes_total',
  help: 'Total password change attempts grouped by result',
  labelNames: ['result'],
});

export const authSessionsTotal = new client.Counter({
  name: 'auth_sessions_total',
  help: 'Total auth session operations grouped by operation and result',
  labelNames: ['operation', 'result'],
});

export const registerAuthMetrics = (register: client.Registry): void => {
  register.registerMetric(authLoginAttemptsTotal);
  register.registerMetric(passwordResetRequestsTotal);
  register.registerMetric(passwordResetConfirmationsTotal);
  register.registerMetric(passwordChangesTotal);
  register.registerMetric(authSessionsTotal);
};