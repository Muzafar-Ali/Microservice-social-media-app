import { Server, Socket } from "socket.io";
import { PresenceService } from "../presence.service.js";
import { ChatService } from "../../services/chat.service.js";

/**
 * handlers:
 * - Join/leave rooms (with membership check)
 * - Typing indicator
 * - Send message (persist + broadcast)
 * - Presence check
 */
export function registerCoreHandlers(
  io: Server,
  socket: Socket,
  presenceService: PresenceService,
  chatService: ChatService
) {
  const userId = socket.data.userId as string;

  // ---- Join a conversation room (on demand) ----
  socket.on(
    "chat:room:join",
    async (payload: { conversationId: string }, callback?: (resp: any) => void) => {
      try {
        const { conversationId } = payload;

        const isMember = await chatService.isParticipant(conversationId, userId);
        if (!isMember) {
          if (callback) callback({ ok: false, message: "Not a conversation member" });
          return;
        }

        await socket.join(`conversation:${conversationId}`);
        if (callback) callback({ ok: true });
      } catch (err) {
        if (callback) callback({ ok: false, message: "Failed to join room" });
      }
    }
  );

  // ---- Leave a conversation room ----
  socket.on(
    "chat:room:leave",
    async (payload: { conversationId: string }, callback?: (resp: any) => void) => {
      const { conversationId } = payload;
      await socket.leave(`conversation:${conversationId}`);
      if (callback) callback({ ok: true });
    }
  );

  // ---- Typing indicator ----
  socket.on("chat:typing", async (payload: { conversationId: string; isTyping: boolean }) => {
    const { conversationId, isTyping } = payload;

    socket.to(`conversation:${conversationId}`).emit("chat:typing", {
      conversationId,
      userId,
      isTyping,
    });
  });

  // ---- Send message (persist + broadcast) ----
  socket.on(
    "chat:message:send",
    async (
      payload: { conversationId: string; body: string; metadata?: any },
      callback?: (resp: any) => void
    ) => {
      try {
        const saved = await chatService.sendMessage({
          senderId: userId,
          conversationId: payload.conversationId,
          body: payload.body,
          metadata: payload.metadata,
        });

        io.to(`conversation:${payload.conversationId}`).emit("chat:message:new", saved);

        if (callback) callback({ ok: true, message: saved });
      } catch (error: any) {
        if (callback) callback({ ok: false, message: error?.message ?? "Failed to send message" });
      }
    }
  );

  // ---- Presence check (handy for UI) ----
  socket.on("presence:check", async (payload: { userId: string }, callback?: (resp: any) => void) => {
    const online = await presenceService.isOnline(payload.userId);
    const lastSeen = await presenceService.getLastSeen(payload.userId);

    if (callback) callback({ userId: payload.userId, online, lastSeen });
  });

  socket.on("chat:read", async (payload: { conversationId: string }, callback?: (resp: any) => void) => {
    try {
      const updated = await chatService.markConversationRead({
        userId,
        conversationId: payload.conversationId,
      });

        // Notify other participants in the room (useful for "seen" UI)
        socket.to(`conversation:${payload.conversationId}`).emit("chat:read:update", updated);

        if (callback) callback({ ok: true, data: updated });
    } catch (error: any) {
      if (callback) callback({ ok: false, message: error?.message ?? "Failed to mark read" });
    }
  });
}