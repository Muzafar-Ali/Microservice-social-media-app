import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import ApiErrorHandler from '../utils/apiErrorHandlerClass.js';
import { redis } from '../config/redisClient.js';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      sessionId?: string;
    }
  }
}

/**
 * Auth middleware:
 * - reads sid cookie or Authorization Bearer session id
 * - loads session from Redis (auth:session:<sid>)
 * - attaches req.userId
 */
const isAuthenticatedRedis = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    let sessionId = req.cookies?.sid;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      sessionId = authHeader.split(' ')[1];
    }

    if (!sessionId) {
      return next(new ApiErrorHandler(StatusCodes.UNAUTHORIZED, 'Please login'));
    }

    const sessionKey = `auth:session:${sessionId}`;
    const sessionJson = await redis.get(sessionKey);

    if (!sessionJson) {
      return next(new ApiErrorHandler(StatusCodes.UNAUTHORIZED, 'Session expired, please login again'));
    }

    const session = JSON.parse(sessionJson) as {
      userId: string | number;
      ip?: string;
      userAgent?: string;
    };

    req.userId = String(session.userId);
    req.sessionId = sessionId;

    return next();
  } catch (error) {
    return next(error);
  }
};

export default isAuthenticatedRedis;
