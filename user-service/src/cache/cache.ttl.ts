export const CACHE_TTL = {
  USER: 60 * 60, // 1 hour
  USER_PROFILE: 60 * 15, // 15 minutes
  SESSION: 60 * 60 * 24 * 7, // 7 days
  LOGIN_LOCKOUT: 60 * 15, // 15 minutes
  FAILED_LOGIN_ATTEMPTS: 60 * 15, // 15 minutes
} as const;
