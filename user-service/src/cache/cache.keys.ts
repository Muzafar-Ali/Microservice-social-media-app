export const failedLoginAttemptsCacheKey = (identifier: string) => {
  return `auth:login:failed-attempts:${identifier}`;
};

export const loginLockoutCacheKey = (identifier: string) => {
  return `auth:login:lockout:${identifier}`;
};

export const sessionCacheKey = (sessionId: string) => {
  return `auth:session:${sessionId}`;
};

export const passwordResetTokenCacheKey = (tokenHash: string) => {
  return `auth:password-reset:token:${tokenHash}`;
};

export const passwordResetUserCacheKey = (userId: string) => {
  return `auth:password-reset:user:${userId}`;
};

export const userCacheKeyById = (userId: string) => {
  return `users:id:${userId}`;
};

export const userCacheKeyByUsername = (username: string) => {
  return `users:username:${username}`;
};

export const userProfileCacheKey = (userId: string) => {
  return `users:profile:${userId}`;
};

export const userProfileByUsernameCacheKey = (username: string) => {
  return `users:profile:username:${username}`;
};
