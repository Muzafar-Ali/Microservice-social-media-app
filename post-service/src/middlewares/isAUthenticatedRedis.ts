import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";

import ApiErrorHandler from "../utils/apiErrorHanlderClass.js";
import { redis } from "../config/redisClient.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

const isAuthenticatedRedis = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    console.log('isAuthenticatedRedis has run')
    // Use a dedicated cookie name like "sid"
    const sessionId = req.cookies?.sid;
    console.log('sessionId', sessionId)
    if (!sessionId) {
      return next(new ApiErrorHandler(StatusCodes.UNAUTHORIZED, "Please login"));
    }

    const sessionKey = `session:${sessionId}`;
    console.log('sessionKey', sessionKey)
    const sessionJson = await redis.get(sessionKey);
    console.log('sessionJson', sessionJson)

    if (!sessionJson) {
      return next(new ApiErrorHandler(StatusCodes.UNAUTHORIZED, "Session expired, please login again"));
    }

    const session = JSON.parse(sessionJson) as { userId: number; ip?: string; userAgent?: string };
    console.log('session', session)

    // Optional hardening (recommended): bind session to IP/User-Agent
    // if (session.ip && session.ip !== req.ip) { ... }
    // if (session.userAgent && session.userAgent !== req.get("user-agent")) { ... }

    req.userId = String(session.userId);
    return next();
  } catch (error) {
    return next(error);
  }
};

export default isAuthenticatedRedis;
