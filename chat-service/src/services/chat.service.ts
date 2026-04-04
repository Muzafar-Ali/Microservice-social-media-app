import { StatusCodes } from "http-status-codes";
import {
  AttachmentType,
  MessageType,
  Prisma,
} from "../generated/prisma/client.js";
import ApiErrorHandler from "../utils/apiErrorHandlerClass.js";
import { ChatRepository } from "../respositories/chat.repository.js";
import {
  BaseConversationDto,
  ConversationListItemDto,
  MessageResponseDto,
  PaginatedMessagesResponseDto,
} from "../types/chat.types.js";
import mapConversation from "../utils/mapConversion.js";

export class ChatService {
  constructor(private readonly chatRepository: ChatRepository) {}

  private mapMessage(message: any): MessageResponseDto {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      type: message.type,
      body: message.body ?? null,
      metadata: message.metadata ?? null,
      clientMessageId: message.clientMessageId ?? null,
      replyToMessageId: message.replyToMessageId ?? null,
      attachments: (message.attachments ?? []).map((attachment: any) => ({
        id: attachment.id,
        type: attachment.type,
        url: attachment.url,
        thumbnailUrl: attachment.thumbnailUrl ?? null,
        mimeType: attachment.mimeType ?? null,
        fileName: attachment.fileName ?? null,
        sizeBytes: attachment.sizeBytes ?? null,
        width: attachment.width ?? null,
        height: attachment.height ?? null,
        durationSec: attachment.durationSec ?? null,
        sortOrder: attachment.sortOrder,
      })),
      receipts: (message.receipts ?? []).map((receipt: any) => ({
        userId: receipt.userId,
        deliveredAt: receipt.deliveredAt
          ? receipt.deliveredAt.toISOString()
          : null,
        seenAt: receipt.seenAt
          ? receipt.seenAt.toISOString()
          : null,
      })),
      createdAt: message.createdAt.toISOString(),
      editedAt: message.editedAt ? message.editedAt.toISOString() : null,
      deletedAt: message.deletedAt ? message.deletedAt.toISOString() : null,
    };
  }

  async createDirectConversation(params: {
    creatorUserId: string;
    type: "DIRECT";
    participantUserId?: string;
  }): Promise<BaseConversationDto> {
    if (!params.participantUserId) {
      throw new ApiErrorHandler(
        StatusCodes.BAD_REQUEST,
        "participantUserId is required for DIRECT chat"
      );
    }

    if (params.participantUserId === params.creatorUserId) {
      throw new ApiErrorHandler(
        StatusCodes.BAD_REQUEST,
        "You cannot create a DIRECT chat with yourself"
      );
    }

    const existingConversation =
      await this.chatRepository.findExistingDirectConversation(
        params.creatorUserId,
        params.participantUserId
      );

    if (existingConversation) {
      return mapConversation(existingConversation);
    }

    const createdConversation =
      await this.chatRepository.createDirectConversation(
        params.creatorUserId,
        params.participantUserId
      );

    return mapConversation(createdConversation);
  }

  async createGroupConversation(params: {
    creatorUserId: string;
    type: "GROUP";
    title?: string;
    participantUserIds?: string[];
  }): Promise<BaseConversationDto> {
    const participantUserIds = params.participantUserIds ?? [];

    if (participantUserIds.length === 0) {
      throw new ApiErrorHandler(
        StatusCodes.BAD_REQUEST,
        "participantUserIds is required for GROUP chat"
      );
    }

    const createdConversation =
      await this.chatRepository.createGroupConversation({
        creatorUserId: params.creatorUserId,
        title: params.title,
        participantUserIds,
      });

    return mapConversation(createdConversation);
  }

  async listMyConversations(userId: string): Promise<ConversationListItemDto[]> {
    const conversations = await this.chatRepository.listUserConversations(userId);

    const conversationListItems = await Promise.all(
      conversations.map(async (conversation: any) => {
        const currentParticipant = await this.chatRepository.findParticipant(
          conversation.id,
          userId
        );

        const unreadCount = await this.chatRepository.countUnreadMessages({
          conversationId: conversation.id,
          userId,
          lastReadAt: currentParticipant?.lastReadAt ?? null,
        });

        return {
          ...mapConversation(conversation),
          lastMessageAt: conversation.lastMessageAt
            ? conversation.lastMessageAt.toISOString()
            : null,
          unreadCount,
          lastMessage: conversation.lastMessage
            ? {
                id: conversation.lastMessage.id,
                senderId: conversation.lastMessage.senderId,
                type: conversation.lastMessage.type,
                body: conversation.lastMessage.body ?? null,
                createdAt: conversation.lastMessage.createdAt.toISOString(),
              }
            : null,
        };
      })
    );

    return conversationListItems;
  }

  async sendMessage(params: {
    senderId: string;
    conversationId: string;
    type: MessageType;
    body?: string | null;
    metadata?: Prisma.InputJsonValue | null;
    clientMessageId: string;
    replyToMessageId?: string | null;
    attachments?: Array<{
      type: AttachmentType;
      url: string;
      thumbnailUrl?: string | null;
      mimeType?: string | null;
      fileName?: string | null;
      sizeBytes?: number | null;
      width?: number | null;
      height?: number | null;
      durationSec?: number | null;
      sortOrder?: number;
    }>;
  }): Promise<MessageResponseDto> {
    const isParticipant = await this.chatRepository.isUserParticipant(
      params.conversationId,
      params.senderId
    );

    if (!isParticipant) {
      throw new ApiErrorHandler(
        StatusCodes.FORBIDDEN,
        "You are not a participant of this conversation"
      );
    }

    if (params.type === MessageType.SYSTEM) {
      throw new ApiErrorHandler(
        StatusCodes.BAD_REQUEST,
        "SYSTEM messages cannot be created directly by clients"
      );
    }

    const existingMessage =
      await this.chatRepository.findMessageByClientMessageId({
        conversationId: params.conversationId,
        clientMessageId: params.clientMessageId,
      });

    if (existingMessage) {
      return this.mapMessage(existingMessage);
    }

    if (params.replyToMessageId) {
      const replyTargetMessage = await this.chatRepository.findMessageById(
        params.replyToMessageId
      );

      if (!replyTargetMessage) {
        throw new ApiErrorHandler(
          StatusCodes.NOT_FOUND,
          "Reply target message not found"
        );
      }

      if (replyTargetMessage.conversationId !== params.conversationId) {
        throw new ApiErrorHandler(
          StatusCodes.BAD_REQUEST,
          "Reply target message does not belong to this conversation"
        );
      }
    }

    const normalizedBody =
      typeof params.body === "string" && params.body.trim().length > 0
        ? params.body.trim()
        : null;

    const createdMessage = await this.chatRepository.createMessage({
      conversationId: params.conversationId,
      senderId: params.senderId,
      type: params.type,
      body: normalizedBody,
      metadata: params.metadata ?? null,
      clientMessageId: params.clientMessageId,
      replyToMessageId: params.replyToMessageId ?? null,
      attachments: params.attachments ?? [],
    });

    return this.mapMessage(createdMessage);
  }

  async getConversationMessages(params: {
    userId: string;
    conversationId: string;
    limit: number;
    cursorMessageId?: string;
  }): Promise<PaginatedMessagesResponseDto> {
    const isParticipant = await this.chatRepository.isUserParticipant(
      params.conversationId,
      params.userId
    );

    if (!isParticipant) {
      throw new ApiErrorHandler(
        StatusCodes.FORBIDDEN,
        "You are not a participant of this conversation"
      );
    }

    const messages = await this.chatRepository.listMessagesByConversation({
      conversationId: params.conversationId,
      limit: params.limit,
      cursorMessageId: params.cursorMessageId,
    });

    const items = messages.map((message: any) => this.mapMessage(message));
    const nextCursor =
      items.length === params.limit ? items[items.length - 1].id : null;

    return {
      items,
      nextCursor,
    };
  }

  async markConversationRead(params: {
    userId: string;
    conversationId: string;
    lastReadMessageId: string;
  }) {
    const isParticipant = await this.chatRepository.isUserParticipant(
      params.conversationId,
      params.userId
    );

    if (!isParticipant) {
      throw new ApiErrorHandler(
        StatusCodes.FORBIDDEN,
        "You are not a participant of this conversation"
      );
    }

    const targetMessage = await this.chatRepository.findMessageById(
      params.lastReadMessageId
    );

    if (!targetMessage) {
      throw new ApiErrorHandler(
        StatusCodes.NOT_FOUND,
        "lastReadMessageId not found"
      );
    }

    if (targetMessage.conversationId !== params.conversationId) {
      throw new ApiErrorHandler(
        StatusCodes.BAD_REQUEST,
        "lastReadMessageId does not belong to this conversation"
      );
    }

    const currentParticipant = await this.chatRepository.findParticipant(
      params.conversationId,
      params.userId
    );

    if (!currentParticipant) {
      throw new ApiErrorHandler(
        StatusCodes.FORBIDDEN,
        "You are not a participant of this conversation"
      );
    }

    if (
      currentParticipant.lastReadAt &&
      currentParticipant.lastReadAt.getTime() >= targetMessage.createdAt.getTime()
    ) {
      return {
        conversationId: params.conversationId,
        userId: params.userId,
        lastReadMessageId:
          currentParticipant.lastReadMessageId ?? params.lastReadMessageId,
        lastReadAt: currentParticipant.lastReadAt.toISOString(),
      };
    }

    const updatedParticipant =
      await this.chatRepository.updateParticipantReadState({
        conversationId: params.conversationId,
        userId: params.userId,
        lastReadMessageId: params.lastReadMessageId,
        lastReadAt: targetMessage.createdAt,
      });

    return {
      conversationId: params.conversationId,
      userId: params.userId,
      lastReadMessageId: updatedParticipant.lastReadMessageId,
      lastReadAt: updatedParticipant.lastReadAt?.toISOString() ?? null,
    };
  }

  async isParticipant(conversationId: string, userId: string) {
    return this.chatRepository.isUserParticipant(conversationId, userId);
  }

  async markMessageDelivered(params: {
    userId: string;
    conversationId: string;
    messageId: string;
  }) {
    const isParticipant = await this.chatRepository.isUserParticipant(
      params.conversationId,
      params.userId
    );

    if (!isParticipant) {
      throw new ApiErrorHandler(
        StatusCodes.FORBIDDEN,
        "You are not a participant of this conversation"
      );
    }

    const targetMessage = await this.chatRepository.findConversationMessageById({
      conversationId: params.conversationId,
      messageId: params.messageId,
    });

    if (!targetMessage) {
      throw new ApiErrorHandler(
        StatusCodes.NOT_FOUND,
        "Message not found in this conversation"
      );
    }

    if (targetMessage.senderId === params.userId) {
      throw new ApiErrorHandler(
        StatusCodes.BAD_REQUEST,
        "Sender cannot mark own message as delivered"
      );
    }

    const deliveredReceipt =
      await this.chatRepository.upsertMessageDeliveryReceipt({
        messageId: params.messageId,
        userId: params.userId,
        deliveredAt: new Date(),
      });

    return {
      conversationId: params.conversationId,
      messageId: params.messageId,
      userId: params.userId,
      deliveredAt: deliveredReceipt.deliveredAt?.toISOString() ?? null,
    };
  }
}