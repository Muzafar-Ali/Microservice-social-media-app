import { ConversationResponseDto } from "../types/caht.types.js";

function mapConversation(conversation: any): ConversationResponseDto {
  return {
    id: conversation.id,
    type: conversation.type,
    title: conversation.title ?? null,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    participants: (conversation.participants ?? []).map((p: any) => ({
      userId: p.userId,
      role: p.role,
      joinedAt: p.joinedAt.toISOString(),
    })),
  };
}

export default mapConversation;