export const KAFKA_TOPICS = {
  POST_EVENTS: "post-events",
  MEDIA_EVENTS: "media-events",
  USER_EVENTS: "user-events",
  POST_SERVICE_USER_EVENTS_DLQ: "post-service-user-events-dlq",
  POST_SERVICE_MEDIA_EVENTS_DLQ: "post-service-media-events-dlq"
} as const;

export const POST_EVENT_NAMES = {
  POST_CREATED: "post.created",
  POST_UPDATED: "post.updated",
  POST_DELETED: "post.deleted",
  POST_PUBLISHED: "post.published",
  POST_ARCHIVED: "post.archived",
  POST_RESTORED: "post.restored",
  POST_MEDIA_ATTACHED: "post.media.attached",
  POST_MEDIA_DETACHED: "post.media.detached",
  POST_VISIBILITY_CHANGED: "post.visibility.changed",
} as const;

export const MEDIA_EVENT_NAMES = {
  MEDIA_UPLOAD_COMPLETED: "media.upload.completed",
  MEDIA_DELETED: "media.deleted",
} as const;

export const USER_EVENT_NAMES = {
  USER_CREATED: "user.created",
  USER_UPDATED: "user.updated",
} as const;