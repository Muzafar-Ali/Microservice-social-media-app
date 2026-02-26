export type ConversationResponseDto = {
  id: string;
  type: "DIRECT" | "GROUP";
  title: string | null;
  createdAt: string;
  updatedAt: string;
  participants: Array<{
    userId: string;
    role: "MEMBER" | "ADMIN";
    joinedAt: string;
  }>;
};