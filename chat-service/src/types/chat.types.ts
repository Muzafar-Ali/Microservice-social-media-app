export type BaseConversationDto = {
  id: string;
  type: "DIRECT" | "GROUP";
  title: string | null;
  createdAt: string;
  updatedAt: string;

  participants: Array<{
    userId: string;
    role: "MEMBER" | "ADMIN";
    joinedAt: string;
    lastReadAt: string | null;
  }>;
};

export type ConversationResponseDto = BaseConversationDto & {
  unreadCount: number;
  lastMessage: null | {
    id: string;
    senderId: string;
    body: string;
    createdAt: string;
  };
};

export type MessageResponseDto = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  metadata: any | null;
  createdAt: string;
};

export type PaginatedMessagesResponseDto = {
  items: MessageResponseDto[];
  nextCursor: string | null; // messageId cursor for next page
};