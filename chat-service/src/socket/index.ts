import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { ChatService } from "../services/chat.service.js";
import { PresenceService } from "./presence.service.js";
import { socketAuthMiddleware } from "./auth.middleware.js";
import logger from "../utils/logger.js";
import { registerCoreHandlers } from "./events/registerCoreHandlers.js";
import config from "../config/config.js";



/**
 * Socket server bootstrapping:
 * - Attach to same HTTP server
 * - Apply auth middleware
 * - Setup connection lifecycle
 * - Hook core handlers (typing/presence)
 */
export function initSocketServer(httpServer: HttpServer, chatService: ChatService) {
  const io = new Server(httpServer, {
    cors: {
      origin: ["http://localhost:3000"],
      credentials: true,
    },
  });

  const presenceService = new PresenceService();

  // 1) Auth middleware for sockets
  io.use(socketAuthMiddleware);

  // 2) Connection lifecycle
  io.on("connection", async (socket) => {
    const userId = socket.data.userId as string;

    logger.info({ userId, socketId: socket.id }, "✅ socket connected");

    // Mark online in Redis (multi-tab safe)
    const presenceOnline = await presenceService.markOnline(userId, socket.id);
    io.emit("presence:update", presenceOnline);

    /**
     * IMPORTANT:
     * We’ll join conversation rooms later, after we implement:
     * - conversation membership in DB
     * - a method in ChatService to list user's conversations
     *
     * For now: no auto-join. We'll add it step-by-step.
     */

    // Register core handlers like typing, presence check
    registerCoreHandlers(io, socket, presenceService);

    // Disconnect handling
    socket.on("disconnect", async () => {
      logger.info({ userId, socketId: socket.id }, "❌ socket disconnected");

      const presenceOffline = await presenceService.markOfflineIfLastSocket(userId, socket.id);
      if (presenceOffline) {
        io.emit("presence:update", presenceOffline);
      }
    });
  });

  logger.info({ port: config.port }, "🔌 Socket.IO initialized (chat-service)");

  return io;
}