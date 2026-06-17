import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { redis } from '../config/redisClient.js';
import ApiErrorHandler from '../utils/apiErrorHandlerClass.js';
import { rateLimitExceededTotal } from '../monitoring/metrics.js';

type RateLimitOptions = {
  keyPrefix: string;
  policyName: string;
  windowSeconds: number;
  maxRequests: number;
  message?: string;
};

const getRequesterKey = (req: Request): string => {
  return req.userId ?? req.sessionId ?? req.ip ?? 'unknown';
};

export const rateLimitByUser = (options: RateLimitOptions) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (options.windowSeconds <= 0 || options.maxRequests <= 0) {
        return next();
      }

      const requesterKey = getRequesterKey(req);
      const key = `rate_limit:post:${options.keyPrefix}:${requesterKey}`;
      const count = await redis.incr(key);

      if (count === 1) {
        await redis.expire(key, options.windowSeconds);
      }

      if (count <= options.maxRequests) {
        return next();
      }

      const ttl = await redis.ttl(key);
      const retryAfterSeconds = ttl > 0 ? ttl : options.windowSeconds;

      res.setHeader('Retry-After', String(retryAfterSeconds));
      rateLimitExceededTotal.inc({ policy: options.policyName });

      return next(
        new ApiErrorHandler(
          StatusCodes.TOO_MANY_REQUESTS,
          options.message ?? 'Too many requests, please try again later',
        ),
      );
    } catch (error) {
      return next(error);
    }
  };
};
