import client from 'prom-client';

export const redisCacheOperationsTotal = new client.Counter({
  name: 'redis_cache_operations_total',
  help: 'Total number of Redis cache operations grouped by operation and result',
  labelNames: ['operation', 'result'],
});

export const registerCacheMetrics = (register: client.Registry): void => {
  register.registerMetric(redisCacheOperationsTotal);
};