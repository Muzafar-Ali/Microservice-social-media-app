import { BaseConversationDto } from "../types/chat.types.js";

function mapConversation(conversation: any): BaseConversationDto {
  return {
    id: conversation.id,
    type: conversation.type,
    title: conversation.title ?? null,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    lastMessageAt: conversation.lastMessageAt
      ? conversation.lastMessageAt.toISOString()
      : null,
    participants: (conversation.participants ?? []).map((participant: any) => ({
      userId: participant.userId,
      role: participant.role,
      joinedAt: participant.joinedAt.toISOString(),
      lastReadAt: participant.lastReadAt
        ? participant.lastReadAt.toISOString()
        : null,
      lastReadMessageId: participant.lastReadMessageId ?? null,
    })),
  };
}

export default mapConversation;