export const KAFKA_TOPICS = {
  MEDIA_EVENTS: 'media-events',
  POST_EVENTS: 'post-events',
  MEDIA_SERVICE_POST_EVENTS_DLQ: 'media-service-post-events-dlq',
} as const;

export const MEDIA_EVENT_NAMES = {
  MEDIA_UPLOAD_COMPLETED: 'media.upload.completed',
  MEDIA_DELETED: 'media.deleted',
} as const;

export const POST_EVENT_NAMES = {
  POST_DELETED: 'post.deleted',
} as const;
