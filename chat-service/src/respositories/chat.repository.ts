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
}