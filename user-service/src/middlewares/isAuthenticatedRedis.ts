import { NextFunction, Request, Response } from 'express';
import ApiErrorHandler from '../utils/apiErrorHandlerClass.js';
import { StatusCodes } from 'http-status-codes';
import { redis } from '../config/redisClient.js';
import { sessionCacheKey } from '../cache/cache.keys.js';
import prisma from '../config/prismaClient.js';

type SessionPayload = {
  userId: string;
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

    const sessionKey = sessionCacheKey(sessionId);
    const sessionJson = await redis.get(sessionKey);

    if (!sessionJson) {
      return next(new ApiErrorHandler(StatusCodes.UNAUTHORIZED, 'Session expired, please login again'));
    }

    const session = JSON.parse(sessionJson) as SessionPayload;

    const activeSession = await prisma.userSession.updateMany({
      where: {
        id: sessionId,
        userId: String(session.userId),
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      data: {
        lastUsedAt: new Date(),
      },
    });

    if (activeSession.count === 0) {
      await redis.del(sessionKey);
      return next(new ApiErrorHandler(StatusCodes.UNAUTHORIZED, 'Session expired, please login again'));
    }

    req.userId = String(session.userId);
    req.sessionId = sessionId;
    return next();
  } catch (error) {
    return next(error);
  }
};

export default isAuthenticatedRedis;
