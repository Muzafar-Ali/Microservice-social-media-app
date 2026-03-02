import { PrismaClient, ConversationType, ParticipantRole } from "../generated/prisma/client.js";

export class ChatRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findExistingDirectConversation(userA: string, userB: string) {
    // Ensures a DIRECT conversation that has userA and userB
    // and has NO other participants besides these two.
    return this.prisma.conversation.findFirst({
      where: {
        type: ConversationType.DIRECT,
        AND: [
          { participants: { some: { userId: userA } } },
          { participants: { some: { userId: userB } } },
          { participants: { none: { userId: { notIn: [userA, userB] } } } },
        ],
      },
      include: { participants: true },
    });
  }

  async createDirectConversation(creatorUserId: string, otherUserId: string) {
    return this.prisma.conversation.create({
      data: {
        type: ConversationType.DIRECT,
        participants: {
          createMany: {
            data: [
              { userId: creatorUserId, role: ParticipantRole.MEMBER },
              { userId: otherUserId, role: ParticipantRole.MEMBER },
            ],
          },
        },
      },
      include: { participants: true },
    });
  }

  async createGroupConversation(params: {
    creatorUserId: string;
    title?: string;
    participantUserIds: string[];
  }) {
    const uniqueUserIds = Array.from(new Set([params.creatorUserId, ...params.participantUserIds]));

    return this.prisma.conversation.create({
      data: {
        type: ConversationType.GROUP,
        title: params.title ?? null,
        participants: {
          createMany: {
            data: uniqueUserIds.map((userId) => ({
              userId,
              role: userId === params.creatorUserId ? ParticipantRole.ADMIN : ParticipantRole.MEMBER,
            })),
          },
        },
      },
      include: { participants: true },
    });
  }

  async listUserConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId },
        },
      },
      include: {
        participants: true,
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async isUserParticipant(conversationId: string, userId: string) {
    const count = await this.prisma.participant.count({
      where: { conversationId, userId },
    });
    return count > 0;
  }

  async createMessage(params: { conversationId: string; senderId: string; body: string; metadata?: any }) {
    // 1) create message
    const message = await this.prisma.message.create({
      data: {
        conversationId: params.conversationId,
        senderId: params.senderId,
        body: params.body,
        metadata: params.metadata ?? undefined,
      },
    });

    // 2) touch conversation updatedAt so it moves to top in lists
    await this.prisma.conversation.update({
      where: { id: params.conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

    async listMessagesByConversation(params: {
    conversationId: string;
    limit: number;
    cursorMessageId?: string;
  }) {
    // Cursor pagination:
    // If cursorMessageId is provided, we fetch messages "before" that message (older).
    return this.prisma.message.findMany({
      where: { conversationId: params.conversationId },
      orderBy: { createdAt: "desc" },
      take: params.limit,
      ...(params.cursorMessageId
        ? {
            cursor: { id: params.cursorMessageId },
            skip: 1, // skip the cursor item itself
          }
        : {}),
    });
  }

  async updateParticipantLastReadAt(params: { conversationId: string; userId: string; readAt: Date }) {
    return this.prisma.participant.update({
      where: {
        conversationId_userId: {
          conversationId: params.conversationId,
          userId: params.userId,
        },
      },
      data: { lastReadAt: params.readAt },
    });
  }

  async getParticipantLastReadAt(conversationId: string, userId: string) {
    return this.prisma.participant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { lastReadAt: true },
    });
  }

  async countUnreadMessages(params: { conversationId: string; userId: string; lastReadAt?: Date | null }) {
    // unread = messages after lastReadAt AND not sent by me
    return this.prisma.message.count({
      where: {
        conversationId: params.conversationId,
        senderId: { not: params.userId },
        ...(params.lastReadAt ? { createdAt: { gt: params.lastReadAt } } : {}),
      },
    });
  }

  async getLastMessage(conversationId: string) {
    return this.prisma.message.findFirst({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      select: { id: true, body: true, senderId: true, createdAt: true },
    });
  }
}