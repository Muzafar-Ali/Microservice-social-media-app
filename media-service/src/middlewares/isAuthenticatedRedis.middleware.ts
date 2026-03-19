import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import ApiErrorHandler from "../utils/apiErrorHandlerClass";
import { redis } from "../config/redisClient";


declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

const isAuthenticatedRedis = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const sessionId = req.cookies?.sid;

    if (!sessionId) {
      return next(new ApiErrorHandler(StatusCodes.UNAUTHORIZED, "Please login"));
    }

    const sessionKey = `session:${sessionId}`;
    const sessionJson = await redis.get(sessionKey);

    if (!sessionJson) {
      return next(new ApiErrorHandler(StatusCodes.UNAUTHORIZED, "Session expired, please login again"));
    }

    const session = JSON.parse(sessionJson) as { userId: number; ip?: string; userAgent?: string };

    req.userId = String(session.userId);
    return next();
  } catch (error) {
    return next(error);
  }
};

export default isAuthenticatedRedis;
