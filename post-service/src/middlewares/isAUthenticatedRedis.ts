import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import ApiErrorHandler from '../utils/apiErrorHandlerClass.js';
import { redis } from '../config/redisClient.js';

type SessionPayload = {
  userId: string | number;
  ip?: string;
  userAgent?: string;
};

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      sessionId?: string;
    }
  }
}

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

    const session = JSON.parse(sessionJson) as SessionPayload;

    // Optional hardening (recommended): bind session to IP/User-Agent
    // if (session.ip && session.ip !== req.ip) { ... }
    // if (session.userAgent && session.userAgent !== req.get("user-agent")) { ... }

    req.userId = String(session.userId);
    req.sessionId = sessionId;
    return next();
  } catch (error) {
    return next(error);
  }
};

export default isAuthenticatedRedis;
