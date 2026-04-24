import { Prisma, MessageType, AttachmentType } from '../generated/prisma/client.js';

export type MessageEntity = {
  id: string;
  conversationId: string;
  senderId: string;
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'SYSTEM' | 'SHARED_POST';
  body: string | null;
  metadata: unknown | null;
  clientMessageId: string | null;
  replyToMessageId: string | null;
  attachments?: MessageAttachmentEntity[];
  receipts?: MessageReceiptEntity[];
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
};

export type MessageAttachmentEntity = {
  id: string;
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE';
  url: string;
  thumbnailUrl: string | null;
  mimeType: string | null;
  fileName: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  sortOrder: number;
};

export type MessageReceiptEntity = {
  userId: string;
  deliveredAt: Date | null;
  seenAt: Date | null;
};

export type CreateMessageAttachmentInput = {
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
};

export type CreateMessageInput = {
  conversationId: string;
  senderId: string;
  type: MessageType;
  body?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  clientMessageId: string;
  replyToMessageId?: string | null;
  attachments?: CreateMessageAttachmentInput[];
};

export type ParticipantDto = {
  userId: string;
  role: 'MEMBER' | 'ADMIN';
  joinedAt: string;
  lastReadAt: string | null;
  lastReadMessageId: string | null;
};

export type MessageAttachmentDto = {
  id: string;
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE';
  url: string;
  thumbnailUrl: string | null;
  mimeType: string | null;
  fileName: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  sortOrder: number;
};

export type MessageReceiptDto = {
  userId: string;
  deliveredAt: string | null;
  seenAt: string | null;
};

export type MessageResponseDto = {
  id: string;
  conversationId: string;
  senderId: string;
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'SYSTEM' | 'SHARED_POST';
  body: string | null;
  metadata: unknown | null;
  clientMessageId: string | null;
  replyToMessageId: string | null;
  attachments: MessageAttachmentDto[];
  receipts: MessageReceiptDto[];
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
};

export type BaseConversationDto = {
  id: string;
  type: 'DIRECT' | 'GROUP';
  title: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  participants: ParticipantDto[];
};

export type ConversationListItemDto = BaseConversationDto & {
  unreadCount: number;
  lastMessage: null | {
    id: string;
    senderId: string;
    type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'SYSTEM' | 'SHARED_POST';
    body: string | null;
    createdAt: string;
  };
};

export type PaginatedMessagesResponseDto = {
  items: MessageResponseDto[];
  nextCursor: string | null;
};

export type DeleteMessageResponseDto = {
  conversationId: string;
  messageId: string;
  deletedBy: string;
  deletedAt: string;
  forEveryone: boolean;
};

export type MessageReactionDto = {
  id: string;
  messageId: string;
  userId: string;
  reaction: string;
  createdAt: string;
};

export type AddReactionResponseDto = {
  id: string;
  conversationId: string;
  messageId: string;
  userId: string;
  reaction: string;
  createdAt: string;
};

export type RemoveReactionResponseDto = {
  conversationId: string;
  messageId: string;
  userId: string;
  reaction: string;
  removed: boolean;
  removedAt: string;
};

export type GroupConversationUpdateResponseDto = {
  conversationId: string;
  title: string | null;
  updatedBy: string;
  updatedAt: string;
};

export type AddParticipantsResponseDto = {
  conversationId: string;
  participantUserIds: string[];
  addedBy: string;
  addedAt: string;
};

export type RemoveParticipantResponseDto = {
  conversationId: string;
  participantUserId: string;
  removedBy: string;
  removedAt: string;
};

export type LeaveGroupResponseDto = {
  conversationId: string;
  userId: string;
  leftAt: string;
};
