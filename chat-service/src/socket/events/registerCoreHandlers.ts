import { Server, Socket } from "socket.io";
import { PresenceService } from "../presence.service.js";

/**
 * In Step 2 we only register "core" handlers:
 * - typing indicator
 * - (optional) join/leave rooms later
 *
 * Message send/receive will be added later when DB schema + routes exist.
 */
export function registerCoreHandlers(io: Server, socket: Socket, presenceService: PresenceService) {
  const userId = socket.data.userId as string;

  // ---- Typing indicator ----
  socket.on("chat:typing", async (payload: { conversationId: string; isTyping: boolean }) => {
    const { conversationId, isTyping } = payload;

    // We emit to everyone else in that conversation room except the sender.
    socket.to(`conversation:${conversationId}`).emit("chat:typing", {
      conversationId,
      userId,
      isTyping,
    });
  });

  // You can also expose a simple presence check event if needed:
  socket.on("presence:check", async (payload: { userId: string }, callback?: (resp: any) => void) => {
    const online = await presenceService.isOnline(payload.userId);
    const lastSeen = await presenceService.getLastSeen(payload.userId);

    if (callback) {
      callback({ userId: payload.userId, online, lastSeen });
    }
  });


}