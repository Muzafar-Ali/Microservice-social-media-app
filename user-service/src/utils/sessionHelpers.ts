import crypto from 'crypto';
import { redis } from '../config/redisClient.js';
import { sessionCacheKey } from './cacheKeys/sessionCacheKeys.js';
import config from '../config/config.js';
import { Response } from 'express';

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

type SessionData = {
  userId: number;
  createdAt: number;
  ip?: string;
  userAgent?: string;
};

export const generateSessionId = () => {
  return crypto.randomBytes(32).toString("hex");
}

export const createWebSession = async ( params: {
  userId: number;
  ip?: string;
  userAgent?: string;
}) => {

  const sessionId = generateSessionId();

  const sessionData: SessionData = {
    userId: params.userId,
    createdAt: Date.now(),
    ip: params.ip,
    userAgent: params.userAgent,
  };

  const key = sessionCacheKey(sessionId);

  await redis.set(
    key,
    JSON.stringify(sessionData),
    { 
      expiration: {
        type: 'EX',
        value: SESSION_TTL_SECONDS
      } 
    }
  )

  return sessionId
}

export const setWebSessionCookie = (res: Response, sessionId: string) => {
  const isProduction = config.environment === "production";

  res.cookie("sid", sessionId, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS * 1000,
  });
}