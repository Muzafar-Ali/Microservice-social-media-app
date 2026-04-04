export type ParticipantDto = {
  userId: string;
  role: "MEMBER" | "ADMIN";
  joinedAt: string;
  lastReadAt: string | null;
  lastReadMessageId: string | null;
};

export type MessageAttachmentDto = {
  id: string;
  type: "IMAGE" | "VIDEO" | "AUDIO" | "FILE";
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

export type MessageReactionDto = {
  reaction: string;
  count: number;
  reactedByMe: boolean;
};

export type MessageResponseDto = {
  id: string;
  conversationId: string;
  senderId: string;
  type: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "FILE" | "SYSTEM" | "SHARED_POST";
  body: string | null;
  metadata: unknown | null;
  clientMessageId: string | null;
  replyToMessageId: string | null;
  attachments: MessageAttachmentDto[];
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
};

export type ConversationListItemDto = {
  id: string;
  type: "DIRECT" | "GROUP";
  title: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  unreadCount: number;
  participants: ParticipantDto[];
  lastMessage: {
    id: string;
    senderId: string;
    type: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "FILE" | "SYSTEM" | "SHARED_POST";
    body: string | null;
    createdAt: string;
  } | null;
};

export type BaseConversationDto = {
  id: string;
  type: "DIRECT" | "GROUP";
  title: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  participants: ParticipantDto[];
};

export type PaginatedMessagesResponseDto = {
  items: MessageResponseDto[];
  nextCursor: string | null;
};