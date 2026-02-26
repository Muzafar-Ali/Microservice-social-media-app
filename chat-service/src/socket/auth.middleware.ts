import { Socket } from "socket.io";
import { redis } from "../config/redisClient.js";
import cookie from "cookie";

/**
 * This middleware runs BEFORE the socket is considered "connected".
 * If we reject here, the connection won't be established.
 */
export async function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void) {
  try {
    const cookieHeader = socket.handshake.headers.cookie;

    if (!cookieHeader) {
      return next(new Error("Unauthorized: missing cookies"));
    }

    const cookies = cookie.parse(cookieHeader);
    const sessionId = cookies.sid;

    if (!sessionId) {
      return next(new Error("Unauthorized: missing sid cookie"));
    }

    const sessionKey = `session:${sessionId}`;
    const sessionJson = await redis.get(sessionKey);

    if (!sessionJson) {
      return next(new Error("Unauthorized: session expired"));
    }

    const session = JSON.parse(sessionJson) as { userId: number; ip?: string; userAgent?: string };

    /**
     * Optional hardening (same idea as your HTTP middleware):
     * - Bind session to IP and/or User-Agent for extra protection.
     * NOTE: With proxies, IP binding can break; be careful in production.
     */
    // if (session.ip && session.ip !== socket.handshake.address) {
    //   return next(new Error("Unauthorized: IP mismatch"));
    // }
    // const ua = socket.handshake.headers["user-agent"];
    // if (session.userAgent && session.userAgent !== ua) {
    //   return next(new Error("Unauthorized: User-Agent mismatch"));
    // }

    socket.data.userId = String(session.userId);
    socket.data.sessionId = sessionId;

    return next();
  } catch (error) {
    return next(new Error("Unauthorized: invalid session"));
  }
}