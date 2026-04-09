import { Socket } from "socket.io";
import cookie from "cookie";
import { redis } from "../config/redisClient.js";

type SocketSessionPayload = {
  userId: string | number;
  ip?: string;
  userAgent?: string;
};

export async function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void
) {
  
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

    const session = JSON.parse(sessionJson) as SocketSessionPayload;

    if (session.userId === undefined || session.userId === null) {
      return next(new Error("Unauthorized: invalid session user"));
    }

    /**
     * Optional hardening:
     * - Bind session to IP and/or User-Agent for extra protection.
     * NOTE:
     * - IP binding can break behind proxies/load balancers
     * - User-Agent matching can also be brittle
     */
    // if (session.ip && session.ip !== socket.handshake.address) {
    //   return next(new Error("Unauthorized: IP mismatch"));
    // }

    // const userAgent = socket.handshake.headers["user-agent"];
    // if (session.userAgent && session.userAgent !== userAgent) {
    //   return next(new Error("Unauthorized: User-Agent mismatch"));
    // }

    socket.data.userId = String(session.userId);
    socket.data.sessionId = sessionId;

    return next();
  } catch (error) {
    return next(new Error("Unauthorized: invalid session"));
  }
}