import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { PresenceService } from "./presence.service.js";
import { socketAuthMiddleware } from "./auth.middleware.js";
import logger from "../utils/logger.js";
import { registerCoreHandlers } from "./events/registerCoreHandlers.js";
import config from "../config/config.js";
import { ChatService } from "../services/chat.service.js";


/**
 * Socket server bootstrapping:
 * - Attach to same HTTP server
 * - Apply auth middleware (sid cookie -> redis session)
 * - Setup presence lifecycle
 * - Auto-join conversation rooms
 * - Register chat handlers
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

    // Auto-join rooms for all conversations the user belongs to
    try {
      const myConversations = await chatService.listMyConversations(userId);
      for (const conversation of myConversations) {
        await socket.join(`conversation:${conversation.id}`);
      }
      logger.info(
        { userId, roomsJoined: myConversations.length },
        "🏠 auto-joined conversation rooms"
      );
    } catch (error) {
      logger.warn({ userId, error }, "⚠️ failed to auto-join rooms");
    }

    // Register handlers (typing, join/leave, send)
    registerCoreHandlers(io, socket, presenceService, chatService);

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