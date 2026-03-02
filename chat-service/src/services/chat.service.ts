import { StatusCodes } from "http-status-codes";
import ApiErrorHandler from "../utils/apiErrorHandlerClass.js";
import { ChatRepository } from "../respositories/chat.repository.js";
import { BaseConversationDto, ConversationResponseDto } from "../types/caht.types.js";
import mapConversation from "../utils/mapConversion.js";

export class ChatService {
  constructor(private readonly chatRepository: ChatRepository) {}

  async createConversation(params: {
    creatorUserId: string;
    type: "DIRECT" | "GROUP";
    participantUserId?: string;
    title?: string;
    participantUserIds?: string[];
  }): Promise<BaseConversationDto> {

    if (params.type === "DIRECT") {
      if (!params.participantUserId) {
        throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, "participantUserId is required for DIRECT chat");
      }

      if (params.participantUserId === params.creatorUserId) {
        throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, "You cannot create a DIRECT chat with yourself");
      }

      const existing = await this.chatRepository.findExistingDirectConversation(
        params.creatorUserId,
        params.participantUserId
      );

      // If direct conversation already exists, return it instead of creating duplicate.
      if (existing) {
        return mapConversation(existing);
      }

      const created = await this.chatRepository.createDirectConversation(
        params.creatorUserId,
        params.participantUserId
      );

      return mapConversation(created);
    }

    // GROUP:
    const participantUserIds = params.participantUserIds ?? [];
    if (participantUserIds.length === 0) {
      throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, "participantUserIds is required for GROUP chat");
    }

    const created = await this.chatRepository.createGroupConversation({
      creatorUserId: params.creatorUserId,
      title: params.title,
      participantUserIds,
    });

    return mapConversation(created);
  }

  // async listMyConversations(userId: string) {
  //   const conversations = await this.chatRepository.listUserConversations(userId);
  //   return conversations.map((c: any) => mapConversation(c));
  // }

  async listMyConversations(userId: string) {
    const conversations = await this.chatRepository.listUserConversations(userId);

    const response = [];
    for (const conversation of conversations as any[]) {
      const participant = conversation.participants?.find((p: any) => p.userId === userId);
      const lastReadAt = participant?.lastReadAt ?? null;

      const unreadCount = await this.chatRepository.countUnreadMessages({
        conversationId: conversation.id,
        userId,
        lastReadAt,
      });

      const lastMessage = await this.chatRepository.getLastMessage(conversation.id);

      response.push({
        ...mapConversation(conversation),
        unreadCount,
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              senderId: lastMessage.senderId,
              body: lastMessage.body,
              createdAt: lastMessage.createdAt.toISOString(),
            }
          : null,
      });
    }

    return response;
  }

  async sendMessage(params: {
    senderId: string;
    conversationId: string;
    body: string;
    metadata?: any;
  }) {
    const isMember = await this.chatRepository.isUserParticipant(params.conversationId, params.senderId);
    if (!isMember) {
      throw new ApiErrorHandler(StatusCodes.FORBIDDEN, "You are not a participant of this conversation");
    }

    const message = await this.chatRepository.createMessage({
      conversationId: params.conversationId,
      senderId: params.senderId,
      body: params.body,
      metadata: params.metadata,
    });

    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      body: message.body,
      metadata: message.metadata,
      createdAt: message.createdAt.toISOString(),
    };
  }

  // message history method
  async getConversationMessages(params: {
    userId: string;
    conversationId: string;
    limit: number;
    cursorMessageId?: string;
  }) {
    const isMember = await this.chatRepository.isUserParticipant(params.conversationId, params.userId);
    if (!isMember) {
      throw new ApiErrorHandler(StatusCodes.FORBIDDEN, "You are not a participant of this conversation");
    }

    const messages = await this.chatRepository.listMessagesByConversation({
      conversationId: params.conversationId,
      limit: params.limit,
      cursorMessageId: params.cursorMessageId,
    });

    const items = messages.map((m: any) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      body: m.body,
      metadata: m.metadata ?? null,
      createdAt: m.createdAt.toISOString(),
    }));

    const nextCursor = items.length === params.limit ? items[items.length - 1].id : null;

    return { items, nextCursor };
  }

  // mark-as-read method
  async markConversationRead(params: { userId: string; conversationId: string }) {
    const isMember = await this.chatRepository.isUserParticipant(params.conversationId, params.userId);
    if (!isMember) {
      throw new ApiErrorHandler(StatusCodes.FORBIDDEN, "You are not a participant of this conversation");
    }

    const readAt = new Date();
    await this.chatRepository.updateParticipantLastReadAt({
      conversationId: params.conversationId,
      userId: params.userId,
      readAt,
    });

    return { conversationId: params.conversationId, userId: params.userId, lastReadAt: readAt.toISOString() };
  }

  async isParticipant(conversationId: string, userId: string) {
    return this.chatRepository.isUserParticipant(conversationId, userId);
  }
}