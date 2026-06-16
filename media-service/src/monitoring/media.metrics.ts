import client from 'prom-client';

export const mediaAssetsVerifiedTotal = new client.Counter({
  name: 'media_assets_verified_total',
  help: 'Total number of uploaded media assets verified',
  labelNames: ['resource_type', 'result'],
});

export const mediaAssetsDeletedTotal = new client.Counter({
  name: 'media_assets_deleted_total',
  help: 'Total number of media assets deleted from provider',
  labelNames: ['resource_type', 'result'],
});

export const mediaCleanupEventsProcessedTotal = new client.Counter({
  name: 'media_cleanup_events_processed_total',
  help: 'Total number of post deletion media cleanup events processed',
  labelNames: ['result'],
});

export const registerMediaMetrics = (register: client.Registry): void => {
  register.registerMetric(mediaAssetsVerifiedTotal);
  register.registerMetric(mediaAssetsDeletedTotal);
  register.registerMetric(mediaCleanupEventsProcessedTotal);
};
