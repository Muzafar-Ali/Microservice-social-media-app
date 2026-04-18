export const KAFKA_TOPICS = {
  USER_EVENTS: "user-events",
  USER_EVENTS_DLQ: "user-events-dlq",
  USER_EVENTS_RETRY: "user-events-retry",
} as const;

export const USER_EVENT_NAMES = {
  USER_CREATED: "user.created",
  USER_UPDATED: "user.updated",
} as const;