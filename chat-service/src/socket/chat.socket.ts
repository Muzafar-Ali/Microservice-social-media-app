import { Server, Socket } from "socket.io";
import { ChatService } from "../services/chat.service.js";
import {
  joinConversationRoomSchema,
  leaveConversationRoomSchema,
  messageDeliveredSchema,
  messageReadSchema,
  sendMessageSchema,
  typingEventSchema,
} from "../validations/chat.validation.js";
import formatZodError from "../utils/formatZodError.js";
import logger from "../utils/logger.js";

type AuthenticatedSocket = Socket & {
  data: {
    userId?: string;
  };
};

type SocketAcknowledgement = (payload: {
  success: boolean;
  message?: string;
  data?: unknown;
}) => void;

const emitSocketError = (
  socket: Socket,
  event: string,
  message: string
) => {
  socket.emit("chat:error", {
    event,
    message,
  });
};

const socketSendMessageSchema = sendMessageSchema.extend({
  conversationId: typingEventSchema.shape.conversationId,
});

/**
 * handlers:
 * - Authenticate and validate socket user
 * - Join personal user room (for direct events)
 * - Join/leave conversation rooms (with validation)
 * - Send message (validate + persist + broadcast)
 * - Typing start/stop indicators
 * - Mark conversation messages as read
 * - Handle socket errors and acknowledgements
 */
export function registerChatSocketHandlers(
  io: Server,
  socket: AuthenticatedSocket,
  chatService: ChatService
) {
  
  const currentUserId = socket.data.userId;

  // ---- Ensure authenticated socket connection ----
  if (!currentUserId) {
    socket.emit("chat:error", {
      event: "socket:auth",
      message: "Unauthorized socket connection",
    });
    
    socket.disconnect(true);
    return;
  }

  // ---- Join a conversation room after payload validation + membership check ----
  socket.on("chat:room:join", async (payload) => {
    const parsedPayload = joinConversationRoomSchema.safeParse(payload);

    if (!parsedPayload.success) {
      const errorMessages = formatZodError(parsedPayload.error);

      emitSocketError(
        socket,
        "chat:room:join",
        errorMessages ?? "Invalid payload"
      );

      return;
    }

    const isParticipant = await chatService.isParticipant(
      parsedPayload.data.conversationId,
      currentUserId
    );

    if (!isParticipant) {
      emitSocketError(
        socket,
        "chat:room:join",
        "You are not a participant of this conversation"
      );
      return;
    }

    await socket.join(`conversation:${parsedPayload.data.conversationId}`);

    logger.info(
      {
        userId: currentUserId,
        conversationId: parsedPayload.data.conversationId,
        socketId: socket.id,
      },
      "📥 joined conversation room"
    );

    socket.emit("chat:room:joined", { conversationId: parsedPayload.data.conversationId });

  });

  // ---- Leave a conversation room after payload validation ----
  socket.on("chat:room:leave", async (payload) => {
    const parsedPayload = leaveConversationRoomSchema.safeParse(payload);

    if (!parsedPayload.success) {
      const errorMessages = formatZodError(parsedPayload.error);

      emitSocketError(
        socket,
        "chat:room:leave",
        errorMessages ?? "Invalid payload"
      );

      return;
    }

    await socket.leave(`conversation:${parsedPayload.data.conversationId}`);

    logger.info(
      {
        userId: currentUserId,
        conversationId: parsedPayload.data.conversationId,
        socketId: socket.id,
      },
      "📤 left conversation room"
    );

    socket.emit("chat:room:left", {conversationId: parsedPayload.data.conversationId});

  });

  // ---- Send message (validate payload + persist message + broadcast updates) ----
  socket.on( "chat:message:send", async (payload, acknowledgement?: SocketAcknowledgement) => {
    try {
      const parsedPayload = socketSendMessageSchema.safeParse(payload);

      if (!parsedPayload.success) {
        const errorMessages = formatZodError(parsedPayload.error)
        const errorMessage =  errorMessages ?? "Invalid payload";

        emitSocketError(socket, "chat:message:send", errorMessage);

        acknowledgement?.({
          success: false,
          message: errorMessage,
        });

        return;
      }

      const createdMessage = await chatService.sendMessage({
        senderId: currentUserId,
        conversationId: parsedPayload.data.conversationId,
        type: parsedPayload.data.type,
        body: parsedPayload.data.body ?? null,
        metadata: parsedPayload.data.metadata as any,
        clientMessageId: parsedPayload.data.clientMessageId,
        replyToMessageId: parsedPayload.data.replyToMessageId ?? null,
        attachments: parsedPayload.data.attachments ?? [],
      });

      io.to(`conversation:${parsedPayload.data.conversationId}`).emit("chat:message:new", createdMessage);

      io.to(`conversation:${parsedPayload.data.conversationId}`).emit("conversation:update",
        {
          conversationId: parsedPayload.data.conversationId,
          lastMessageId: createdMessage.id,
          lastMessageAt: createdMessage.createdAt,
        }
      );

      acknowledgement?.({
        success: true,
        data: createdMessage,
      });

    } catch (error: any) {
      const errorMessage = error?.message ?? "Unexpected error while sending message";

      emitSocketError(socket, "chat:message:send", errorMessage);

      acknowledgement?.({
        success: false,
        message: errorMessage,
      });
    }
  });

  // ---- Typing start indicator (validate + membership check + notify room) ----
  socket.on("chat:typing:start", async (payload) => {

    const parsedPayload = typingEventSchema.safeParse(payload);

    if (!parsedPayload.success) {
      const errorMessages = formatZodError(parsedPayload.error);
      const errorMessage =  errorMessages ?? "Invalid payload"

      emitSocketError(socket, "chat:typing:start", errorMessage);
      return;
    }

    const isParticipant = await chatService.isParticipant(
      parsedPayload.data.conversationId,
      currentUserId
    );

    if (!isParticipant) {
      emitSocketError(socket, "chat:typing:start", "You are not a participant of this conversation");
      return;
    }

    socket.to(`conversation:${parsedPayload.data.conversationId}`).emit("chat:typing:update",
      {
        conversationId: parsedPayload.data.conversationId,
        userId: currentUserId,
        isTyping: true,
      }
    );
  });

  // ---- Typing stop indicator (validate + membership check + notify room) ----
  socket.on("chat:typing:stop", async (payload) => {

    const parsedPayload = typingEventSchema.safeParse(payload);

    if (!parsedPayload.success) {
      const errorMessages = formatZodError(parsedPayload.error);

      emitSocketError(socket, "chat:typing:stop", errorMessages ?? "Invalid payload");
      return;
    }

    const isParticipant = await chatService.isParticipant(
      parsedPayload.data.conversationId,
      currentUserId
    );

    if (!isParticipant) {
      emitSocketError(socket, "chat:typing:stop", "You are not a participant of this conversation");
      return;
    }

    socket.to(`conversation:${parsedPayload.data.conversationId}`).emit("chat:typing:update",
      {
        conversationId: parsedPayload.data.conversationId,
        userId: currentUserId,
        isTyping: false,
      }
    );
  });

  // ---- Mark conversation as read (validate + update read state + notify others) ----
  socket.on("chat:message:read", async (payload, acknowledgement?: SocketAcknowledgement) => {
    try {
      const parsedPayload = messageReadSchema.safeParse(payload);

      if (!parsedPayload.success) {
        const errorMessages = formatZodError(parsedPayload.error);

        emitSocketError(
          socket, 
          "chat:message:read", 
          errorMessages ?? "Invalid payload"
        );

        acknowledgement?.({
          success: false,
          message: errorMessages,
        });

        return;
      }

      const readState = await chatService.markConversationRead({
        userId: currentUserId,
        conversationId: parsedPayload.data.conversationId,
        lastReadMessageId: parsedPayload.data.lastReadMessageId,
      });

      socket.to(`conversation:${parsedPayload.data.conversationId}`).emit("chat:message:read:update", readState);

      socket.emit("chat:message:read:ack", readState);

      acknowledgement?.({
        success: true,
        data: readState,
      });

    } catch (error: any) {
      const errorMessage = error?.message ?? "Unexpected error while marking conversation read";

      emitSocketError(socket, "chat:message:read", errorMessage);

      acknowledgement?.({
        success: false,
        message: errorMessage,
      });
    }
  });

  // ---- Mark conversation as delivered (validate + update read state + notify others) ----
  socket.on("chat:message:delivered", async (payload, acknowledgement?: SocketAcknowledgement) => {
    try {
      const parsedPayload = messageDeliveredSchema.safeParse(payload);

      if (!parsedPayload.success) {
        const errorMessages = formatZodError(parsedPayload.error);
        const errorMessage = errorMessages ?? "Invalid payload";

        emitSocketError(socket, "chat:message:delivered", errorMessage);

        acknowledgement?.({
          success: false,
          message: errorMessage,
        });

        return;
      }

      const deliveryState = await chatService.markMessageDelivered({
        userId: currentUserId,
        conversationId: parsedPayload.data.conversationId,
        messageId: parsedPayload.data.messageId,
      });

      socket.to(`conversation:${parsedPayload.data.conversationId}`).emit("chat:message:delivered:update", deliveryState);

      socket.emit("chat:message:delivered:ack", deliveryState);

      acknowledgement?.({
        success: true,
        data: deliveryState,
      });

    } catch (error: any) {
      const errorMessage =  error?.message ?? "Unexpected error while marking message delivered";

      emitSocketError(socket, "chat:message:delivered", errorMessage);

      acknowledgement?.({
        success: false,
        message: errorMessage,
      });
    }
  });
}