import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { PresenceService } from "./presence.service.js";
import { socketAuthMiddleware } from "./auth.middleware.js";
import logger from "../utils/logger.js";
import config from "../config/config.js";
import { ChatService } from "../services/chat.service.js";
import { registerChatSocketHandlers } from "./chat.socket.js";

let ioInstance: Server | null = null;

export function getSocketServer() {
  if (!ioInstance) {
    throw new Error("Socket.IO server is not initialized");
  }

  return ioInstance;
}

/**
 * Socket server bootstrapping:
 * - Attach to same HTTP server
 * - Apply auth middleware (sid cookie -> redis session)
 * - Setup presence lifecycle
 * - Auto-join conversation rooms
 * - Register chat handlers
 */
export function initSocketServer(
  httpServer: HttpServer,
  chatService: ChatService
) {
  
  const io = new Server(httpServer, {
    cors: {
      origin: ["http://localhost:3000"],
      credentials: true,
    },
  });

  ioInstance = io;
  
  const presenceService = new PresenceService();

  io.use(socketAuthMiddleware);

  io.on("connection", async (socket) => {
    const userId = socket.data.userId as string;

    logger.info({ userId, socketId: socket.id }, "✅ socket connected");

    const presenceOnline = await presenceService.markOnline(userId, socket.id);

    io.emit("presence:update", presenceOnline);

  
    try {
      const myConversations = await chatService.listMyConversations(userId);

      for (const conversation of myConversations) {
        await socket.join(`conversation:${conversation.id}`);
      }

      logger.info({ userId, roomsJoined: myConversations.length }, "🏠 auto-joined conversation rooms");
      
    } catch (error) {
      logger.warn({ userId, error }, "⚠️ failed to auto-join conversation rooms");
    }

    registerChatSocketHandlers(io, socket as any, chatService);

    socket.on("disconnect", async () => {
      
      logger.info({ userId, socketId: socket.id }, "❌ socket disconnected");

      const presenceOffline = await presenceService.markOfflineIfLastSocket(
        userId,
        socket.id
      );

      if (presenceOffline) {
        io.emit("presence:update", presenceOffline);
      }
    });
  });

  logger.info({ port: config.port }, "🔌 Socket.IO initialized (chat-service)");

  return io;
}