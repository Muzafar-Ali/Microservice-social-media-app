import { StatusCodes } from "http-status-codes";
import {
  AttachmentType,
  MessageType,
  Prisma,
  ParticipantRole
} from "../generated/prisma/client.js";
import ApiErrorHandler from "../utils/apiErrorHandlerClass.js";
import { ChatRepository } from "../respositories/chat.repository.js";
import {
  AddParticipantsResponseDto,
  AddReactionResponseDto,
  BaseConversationDto,
  ConversationListItemDto,
  DeleteMessageResponseDto,
  GroupConversationUpdateResponseDto,
  LeaveGroupResponseDto,
  MessageResponseDto,
  PaginatedMessagesResponseDto,
  RemoveParticipantResponseDto,
  RemoveReactionResponseDto,
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
      throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, "participantUserId is required for DIRECT chat");
    }

    if (params.participantUserId === params.creatorUserId) {
      throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, "You cannot create a DIRECT chat with yourself");
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
      throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, "participantUserIds is required for GROUP chat");
    }

    const createdConversation = await this.chatRepository.createGroupConversation({
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
      throw new ApiErrorHandler(StatusCodes.FORBIDDEN, "You are not a participant of this conversation");
    }

    if (params.type === MessageType.SYSTEM) {
      throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, "SYSTEM messages cannot be created directly by clients");
    }

    const existingMessage = await this.chatRepository.findMessageByClientMessageId({
      conversationId: params.conversationId,
      clientMessageId: params.clientMessageId,
    });

    if (existingMessage) {
      return this.mapMessage(existingMessage);
    }

    if (params.replyToMessageId) {
      const replyTargetMessage = await this.chatRepository.findMessageById(params.replyToMessageId);

      if (!replyTargetMessage) {
        throw new ApiErrorHandler(StatusCodes.NOT_FOUND, "Reply target message not found");
      }

      if (replyTargetMessage.conversationId !== params.conversationId) {
        throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, "Reply target message does not belong to this conversation");
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
      throw new ApiErrorHandler(StatusCodes.FORBIDDEN, "You are not a participant of this conversation");
    }

    const messages = await this.chatRepository.listMessagesByConversation({
      conversationId: params.conversationId,
      limit: params.limit,
      cursorMessageId: params.cursorMessageId,
    });

    const items = messages.map((message: any) => this.mapMessage(message));

    const nextCursor = items.length === params.limit ? items[items.length - 1].id : null;

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
      throw new ApiErrorHandler(StatusCodes.FORBIDDEN, "You are not a participant of this conversation");
    }

    const targetMessage = await this.chatRepository.findMessageById(params.lastReadMessageId);

    if (!targetMessage) {
      throw new ApiErrorHandler(StatusCodes.NOT_FOUND, "lastReadMessageId not found");
    }

    if (targetMessage.conversationId !== params.conversationId) {
      throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, "lastReadMessageId does not belong to this conversation");
    }

    const currentParticipant = await this.chatRepository.findParticipant(
      params.conversationId,
      params.userId
    );

    if (!currentParticipant) {
      throw new ApiErrorHandler(StatusCodes.FORBIDDEN, "You are not a participant of this conversation");
    }

    if (currentParticipant.lastReadAt && currentParticipant.lastReadAt.getTime() >= targetMessage.createdAt.getTime()) {
      return {
        conversationId: params.conversationId,
        userId: params.userId,
        lastReadMessageId: currentParticipant.lastReadMessageId ?? params.lastReadMessageId,
        lastReadAt: currentParticipant.lastReadAt.toISOString(),
      };
    }

    const updatedParticipant = await this.chatRepository.updateParticipantReadState({
      conversationId: params.conversationId,
      userId: params.userId,
      lastReadMessageId: params.lastReadMessageId,
      lastReadAt: targetMessage.createdAt,
    });

    await this.chatRepository.markMessagesSeenUpTo({
      conversationId: params.conversationId,
      userId: params.userId,
      seenAt: targetMessage.createdAt,
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
      throw new ApiErrorHandler(StatusCodes.FORBIDDEN, "You are not a participant of this conversation");
    }

    const targetMessage = await this.chatRepository.findConversationMessageById({
      conversationId: params.conversationId,
      messageId: params.messageId,
    });

    if (!targetMessage) {
      throw new ApiErrorHandler(StatusCodes.NOT_FOUND, "Message not found in this conversation");
    }

    if (targetMessage.senderId === params.userId) {
      throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, "Sender cannot mark own message as delivered");
    }

    const deliveredReceipt = await this.chatRepository.upsertMessageDeliveryReceipt({
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

  async deleteMessage(params: {
    userId: string;
    messageId: string;
    forEveryone: boolean;
  }): Promise<DeleteMessageResponseDto> {
    
    if (!params.forEveryone) {
      throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, "Only forEveryone delete is supported right now");
    }

    const targetMessage = await this.chatRepository.findMessageById(params.messageId);

    if (!targetMessage) {
      throw new ApiErrorHandler(StatusCodes.NOT_FOUND, "Message not found");
    }

    if (targetMessage.senderId !== params.userId) {
      throw new ApiErrorHandler(StatusCodes.FORBIDDEN, "You can only delete your own messages");
    }

    if (targetMessage.deletedAt) {
      throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, "Message is already deleted");
    }

    const deletedMessage = await this.chatRepository.softDeleteMessage(params.messageId);

    const conversation = await this.chatRepository.findConversationById(deletedMessage.conversationId);

    if (conversation?.lastMessageId === deletedMessage.id) {
      await this.chatRepository.updateConversationLastMessageFromLatest(deletedMessage.conversationId);
    }

    return {
      conversationId: deletedMessage.conversationId,
      messageId: deletedMessage.id,
      deletedBy: params.userId,
      deletedAt: deletedMessage.deletedAt!.toISOString(),
      forEveryone: true,
    };
  }

  async addReaction(params: {
    userId: string;
    messageId: string;
    reaction: string;
  }): Promise<AddReactionResponseDto> {

    const targetMessage = await this.chatRepository.findMessageById(params.messageId);

    if (!targetMessage) {
      throw new ApiErrorHandler(StatusCodes.NOT_FOUND, "Message not found");
    }

    if (targetMessage.deletedAt) {
      throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, "Cannot react to a deleted message");
    }

    const isParticipant = await this.chatRepository.isUserParticipant(
      targetMessage.conversationId,
      params.userId
    );

    if (!isParticipant) {
      throw new ApiErrorHandler(StatusCodes.FORBIDDEN, "You are not a participant of this conversation");
    }

    const existingReaction = await this.chatRepository.findReaction({
      messageId: params.messageId,
      userId: params.userId,
      reaction: params.reaction,
    });

    if (existingReaction) {
      return {
        id: existingReaction.id,
        conversationId: targetMessage.conversationId,
        messageId: existingReaction.messageId,
        userId: existingReaction.userId,
        reaction: existingReaction.reaction,
        createdAt: existingReaction.createdAt.toISOString(),
      };
    }

    const createdReaction = await this.chatRepository.addReaction({
      messageId: params.messageId,
      userId: params.userId,
      reaction: params.reaction,
    });

    return {
      id: createdReaction.id,
      conversationId: targetMessage.conversationId,
      messageId: createdReaction.messageId,
      userId: createdReaction.userId,
      reaction: createdReaction.reaction,
      createdAt: createdReaction.createdAt.toISOString(),
    };
  }

  async removeReaction(params: {
    userId: string;
    messageId: string;
    reaction: string;
  }): Promise<RemoveReactionResponseDto> {

    const targetMessage = await this.chatRepository.findMessageById(params.messageId);

    if (!targetMessage) {
      throw new ApiErrorHandler(StatusCodes.NOT_FOUND, "Message not found");
    }

    const isParticipant = await this.chatRepository.isUserParticipant(
      targetMessage.conversationId,
      params.userId
    );

    if (!isParticipant) {
      throw new ApiErrorHandler(StatusCodes.FORBIDDEN, "You are not a participant of this conversation");
    }

    const deleteResult = await this.chatRepository.removeReaction({
      messageId: params.messageId,
      userId: params.userId,
      reaction: params.reaction,
    });

    return {
      conversationId: targetMessage.conversationId,
      messageId: params.messageId,
      userId: params.userId,
      reaction: params.reaction,
      removed: deleteResult.count > 0,
      removedAt: new Date().toISOString(),
    };
  }

  async updateGroupConversation(params: {
    userId: string;
    conversationId: string;
    title: string;
  }): Promise<GroupConversationUpdateResponseDto> {

    const conversation = await this.chatRepository.findConversationByIdWithParticipants(params.conversationId);

    if (!conversation) {
      throw new ApiErrorHandler(StatusCodes.NOT_FOUND, "Conversation not found");
    }

    if (conversation.type !== "GROUP") {
      throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, "Only group conversations can be updated");
    }

    const currentParticipant = conversation.participants.find(
      (participant: any) => participant.userId === params.userId && participant.deletedAt === null
    );

    if (!currentParticipant) {
      throw new ApiErrorHandler(StatusCodes.FORBIDDEN, "You are not a participant of this conversation");
    }

    if (currentParticipant.role !== ParticipantRole.ADMIN) {
      throw new ApiErrorHandler(StatusCodes.FORBIDDEN,"Only group admins can update group title");
    }

    const updatedConversation = await this.chatRepository.updateGroupConversationTitle({
        conversationId: params.conversationId,
        title: params.title.trim(),
      });

    return {
      conversationId: updatedConversation.id,
      title: updatedConversation.title ?? null,
      updatedBy: params.userId,
      updatedAt: updatedConversation.updatedAt.toISOString(),
    };
  }

  async addParticipants(params: {
    userId: string;
    conversationId: string;
    participantUserIds: string[];
  }): Promise<AddParticipantsResponseDto> {

    const conversation = await this.chatRepository.findConversationByIdWithParticipants(params.conversationId);

    if (!conversation) {
      throw new ApiErrorHandler(StatusCodes.NOT_FOUND, "Conversation not found");
    }

    if (conversation.type !== "GROUP") {
      throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, "Only group conversations can add participants");
    }

    const currentParticipant = conversation.participants.find(
      (participant: any) => participant.userId === params.userId && participant.deletedAt === null
    );

    if (!currentParticipant) {
      throw new ApiErrorHandler(StatusCodes.FORBIDDEN, "You are not a participant of this conversation");
    }

    if (currentParticipant.role !== ParticipantRole.ADMIN) {
      throw new ApiErrorHandler(StatusCodes.FORBIDDEN, "Only group admins can add participants");
    }

    const uniqueParticipantUserIds = Array.from(
      new Set(
        params.participantUserIds
          .map((participantUserId) => participantUserId.trim())
          .filter(Boolean)
          .filter((participantUserId) => participantUserId !== params.userId)
      )
    );

    const activeParticipantUserIds = new Set(
      conversation.participants
        .filter((participant: any) => participant.deletedAt === null)
        .map((participant: any) => participant.userId)
    );
  
    const alreadyExistingParticipantUserIds = uniqueParticipantUserIds.filter(
      (participantUserId) => activeParticipantUserIds.has(participantUserId)
    );

    if (alreadyExistingParticipantUserIds.length > 0) {
      throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, `User(s) already exist in the conversation: ${alreadyExistingParticipantUserIds.join(", ")}`);
    }
    
    const createdParticipants = await this.chatRepository.addParticipantsToConversation({
      conversationId: params.conversationId,
      participantUserIds: uniqueParticipantUserIds,
    });

    return {
      conversationId: params.conversationId,
      participantUserIds: createdParticipants.map( (participant: any) => participant.userId ),
      addedBy: params.userId,
      addedAt: new Date().toISOString(),
    };
  }

  async removeParticipant(params: {
    userId: string;
    conversationId: string;
    participantUserId: string;
  }): Promise<RemoveParticipantResponseDto> {

    const conversation = await this.chatRepository.findConversationByIdWithParticipants(params.conversationId);

    if (!conversation) {
      throw new ApiErrorHandler(StatusCodes.NOT_FOUND, "Conversation not found");
    }

    if (conversation.type !== "GROUP") {
      throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, "Only group conversations can remove participants");
    }

    const currentParticipant = conversation.participants.find(
      (participant: any) => participant.userId === params.userId && participant.deletedAt === null
    );

    if (!currentParticipant) {
      throw new ApiErrorHandler(StatusCodes.FORBIDDEN, "You are not a participant of this conversation");
    }

    if (currentParticipant.role !== ParticipantRole.ADMIN) {
      throw new ApiErrorHandler(StatusCodes.FORBIDDEN, "Only group admins can remove participants");
    }

    const targetParticipant = conversation.participants.find(
      (participant: any) => participant.userId === params.participantUserId && participant.deletedAt === null
    );

    if (!targetParticipant) {
      throw new ApiErrorHandler(StatusCodes.NOT_FOUND, "Participant not found in this conversation");
    }

    if (targetParticipant.role === ParticipantRole.ADMIN) {
      const adminCount = await this.chatRepository.countConversationAdmins(
        params.conversationId
      );

      if (adminCount <= 1) {
        throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, "Cannot remove the last admin from the group");
      }
    }

    await this.chatRepository.removeParticipantFromConversation({
      conversationId: params.conversationId,
      participantUserId: params.participantUserId,
    });

    return {
      conversationId: params.conversationId,
      participantUserId: params.participantUserId,
      removedBy: params.userId,
      removedAt: new Date().toISOString(),
    };
  }

  async leaveGroupConversation(params: {
    userId: string;
    conversationId: string;
  }): Promise<LeaveGroupResponseDto> {

    const conversation = await this.chatRepository.findConversationByIdWithParticipants(params.conversationId);
    console.log('conversation', conversation);
    

    if (!conversation) {
      throw new ApiErrorHandler(StatusCodes.NOT_FOUND, "Conversation not found");
    }

    if (conversation.type !== "GROUP") {
      throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, "Only group conversations support leave");
    }

    const currentParticipant = conversation.participants.find(
      (participant: any) => participant.userId === params.userId && participant.deletedAt === null
    );

    if (!currentParticipant) {
      throw new ApiErrorHandler(StatusCodes.FORBIDDEN, "You are not a participant of this conversation");
    }

    if (currentParticipant.role === ParticipantRole.ADMIN) {
      const adminCount = await this.chatRepository.countConversationAdmins(params.conversationId);

      if (adminCount < 1) {
        throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, "Last admin cannot leave the group");
      }
    }

    await this.chatRepository.removeParticipantFromConversation({
      conversationId: params.conversationId,
      participantUserId: params.userId,
    });

    return {
      conversationId: params.conversationId,
      userId: params.userId,
      leftAt: new Date().toISOString(),
    };
  }

}