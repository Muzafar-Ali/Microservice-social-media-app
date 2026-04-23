export const KAFKA_TOPICS = {
  USER_EVENTS: 'user-events',
  SOCIAL_GRAPH_EVENTS: 'social-graph-events',
  SOCIAL_GRAPH_EVENTS_DLQ: 'social-graph-events-dlq-user-service',
} as const;

export const USER_EVENT_NAMES = {
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
} as const;

export const SOCIAL_GRAPH_EVENT_NAMES = {
  FOLLOW_CREATED: 'follow.created',
  FOLLOW_REMOVED: 'follow.removed',
  FOLLOW_REQUESTED: 'follow.requested',
  FOLLOW_ACCEPTED: 'follow.accepted',
} as const;
