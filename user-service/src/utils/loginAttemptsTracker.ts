import { redis } from "../config/redisClient.js";
import { TLoginContext } from "../modules/auth/auth.types.js";
import logger from "./logger.js";
import { failedLoginAttemptsCacheKey, loginLockoutCacheKey } from "./cacheKeys/authCacheKeys.js";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_TTL_SECONDS = 15 * 60; // 15 minutes
const FAILURE_WINDOW_SECONDS = 15 * 60; // window in which failures accumulate

export const recordFailedLoginAttempt = async (context: TLoginContext) => {

  const failKey = failedLoginAttemptsCacheKey(context.identifier);
  const lockKey = loginLockoutCacheKey(context.identifier);

  const newCount = await redis.incr(failKey);

  // Set TTL on the failed-attempt counter key on the first failure only,
  // starting a fixed-time window for counting attempts (no sliding reset).
  if(newCount === 1) {
    await redis.expire(failKey, FAILURE_WINDOW_SECONDS);
  }

  logger.warn(
    {
      identifier: context.identifier,
      ip: context.ip,
      userAgent: context.userAgent,
      failedAttempts: newCount,
    },

    "Failed login attempt"
  );

  // Lock the user temporarily after 5 failed login attempts
  if( newCount === MAX_FAILED_ATTEMPTS ) {
    const lockKey = loginLockoutCacheKey(context.identifier);
    await redis.set( lockKey, "1", { EX: LOCKOUT_TTL_SECONDS } );
    
    logger.warn(
      {
        identifier: context.identifier,
        ip: context.ip,
      },
      "User locked due to too many failed login attempts"
    );
  }

  return newCount;
}

export const resetFailedLoginAttempts = async (identifier: string) => {

  const key = failedLoginAttemptsCacheKey(identifier);
  await redis.del(key);

  const lockKey = loginLockoutCacheKey(identifier);
  await redis.del(lockKey);
}

export const isLoginLocked = async (identifier: string) => {

  const lockKey = loginLockoutCacheKey(identifier);
  const locked = await redis.get(lockKey);

  return locked === "1";
};