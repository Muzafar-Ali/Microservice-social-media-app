import {
  PrismaClient,
  Prisma,
  ConversationType,
  ParticipantRole,
  MessageType,
  AttachmentType,
} from "../generated/prisma/client.js";

type CreateMessageAttachmentInput = {
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

type CreateMessageInput = {
  conversationId: string;
  senderId: string;
  type: MessageType;
  body?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  clientMessageId: string;
  replyToMessageId?: string | null;
  attachments?: CreateMessageAttachmentInput[];
};

export class ChatRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findConversationById(conversationId: string) {
    return this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: true,
        lastMessage: {
          include: {
            attachments: true,
          },
        },
      },
    });
  }

  async findExistingDirectConversation(userA: string, userB: string) {
    return this.prisma.conversation.findFirst({
      where: {
        type: ConversationType.DIRECT,
        AND: [
          { participants: { some: { userId: userA } } },
          { participants: { some: { userId: userB } } },
          { participants: { none: { userId: { notIn: [userA, userB] } } } },
        ],
      },
      include: {
        participants: true,
        lastMessage: true,
      },
    });
  }

  async createDirectConversation(creatorUserId: string, otherUserId: string) {
    return this.prisma.conversation.create({
      data: {
        type: ConversationType.DIRECT,
        participants: {
          createMany: {
            data: [
              {
                userId: creatorUserId,
                role: ParticipantRole.MEMBER,
              },
              {
                userId: otherUserId,
                role: ParticipantRole.MEMBER,
              },
            ],
          },
        },
      },
      include: {
        participants: true,
        lastMessage: true,
      },
    });
  }

  async createGroupConversation(params: {
    creatorUserId: string;
    title?: string;
    participantUserIds: string[];
  }) {
    const uniqueParticipantUserIds = Array.from(
      new Set([params.creatorUserId, ...params.participantUserIds])
    );

    return this.prisma.conversation.create({
      data: {
        type: ConversationType.GROUP,
        title: params.title ?? null,
        createdBy: params.creatorUserId,
        participants: {
          createMany: {
            data: uniqueParticipantUserIds.map((userId) => ({
              userId,
              role:
                userId === params.creatorUserId
                  ? ParticipantRole.ADMIN
                  : ParticipantRole.MEMBER,
            })),
          },
        },
      },
      include: {
        participants: true,
        lastMessage: true,
      },
    });
  }

  async listUserConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: {
        participants: {
          some: {
            userId,
            deletedAt: null,
          },
        },
      },
      include: {
        participants: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            joinedAt: "asc",
          },
        },
        lastMessage: {
          include: {
            attachments: {
              orderBy: {
                sortOrder: "asc",
              },
            },
          },
        },
      },
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
    });
  }

  async isUserParticipant(conversationId: string, userId: string) {
    const participantCount = await this.prisma.participant.count({
      where: {
        conversationId,
        userId,
        deletedAt: null,
      },
    });

    return participantCount > 0;
  }

  async findParticipant(conversationId: string, userId: string) {
    return this.prisma.participant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });
  }

  async findMessageById(messageId: string) {
    return this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        attachments: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });
  }

  async findMessageByClientMessageId(params: {
    conversationId: string;
    clientMessageId: string;
  }) {
    return this.prisma.message.findUnique({
      where: {
        conversationId_clientMessageId: {
          conversationId: params.conversationId,
          clientMessageId: params.clientMessageId,
        },
      },
      include: {
        attachments: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });
  }

  async createMessage(params: CreateMessageInput) {
    return this.prisma.$transaction(async (transactionClient) => {
      const createdMessage = await transactionClient.message.create({
        data: {
          conversationId: params.conversationId,
          senderId: params.senderId,
          type: params.type,
          body: params.body ?? null,
          metadata: params.metadata ?? Prisma.JsonNull,
          clientMessageId: params.clientMessageId,
          replyToMessageId: params.replyToMessageId ?? null,
          attachments: params.attachments?.length
            ? {
                create: params.attachments.map((attachment, attachmentIndex) => ({
                  type: attachment.type,
                  url: attachment.url,
                  thumbnailUrl: attachment.thumbnailUrl ?? null,
                  mimeType: attachment.mimeType ?? null,
                  fileName: attachment.fileName ?? null,
                  sizeBytes: attachment.sizeBytes ?? null,
                  width: attachment.width ?? null,
                  height: attachment.height ?? null,
                  durationSec: attachment.durationSec ?? null,
                  sortOrder: attachment.sortOrder ?? attachmentIndex,
                })),
              }
            : undefined,
        },
        include: {
          attachments: {
            orderBy: {
              sortOrder: "asc",
            },
          },
        },
      });

      await transactionClient.conversation.update({
        where: {
          id: params.conversationId,
        },
        data: {
          lastMessageId: createdMessage.id,
          lastMessageAt: createdMessage.createdAt,
          updatedAt: createdMessage.createdAt,
        },
      });

      return createdMessage;
    });
  }

  async listMessagesByConversation(params: {
    conversationId: string;
    limit: number;
    cursorMessageId?: string;
  }) {
    return this.prisma.message.findMany({
      where: {
        conversationId: params.conversationId,
        deletedAt: null,
      },
      include: {
        attachments: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: params.limit,
      ...(params.cursorMessageId
        ? {
            cursor: {
              id: params.cursorMessageId,
            },
            skip: 1,
          }
        : {}),
    });
  }

  async updateParticipantReadState(params: {
    conversationId: string;
    userId: string;
    lastReadAt: Date;
    lastReadMessageId: string;
  }) {
    return this.prisma.participant.update({
      where: {
        conversationId_userId: {
          conversationId: params.conversationId,
          userId: params.userId,
        },
      },
      data: {
        lastReadAt: params.lastReadAt,
        lastReadMessageId: params.lastReadMessageId,
      },
    });
  }

  async countUnreadMessages(params: {
    conversationId: string;
    userId: string;
    lastReadAt?: Date | null;
  }) {
    return this.prisma.message.count({
      where: {
        conversationId: params.conversationId,
        deletedAt: null,
        senderId: {
          not: params.userId,
        },
        ...(params.lastReadAt
          ? {
              createdAt: {
                gt: params.lastReadAt,
              },
            }
          : {}),
      },
    });
  }

  async getLastMessage(conversationId: string) {
    return this.prisma.message.findFirst({
      where: {
        conversationId,
        deletedAt: null,
      },
      include: {
        attachments: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

    async upsertMessageDeliveryReceipt(params: {
    messageId: string;
    userId: string;
    deliveredAt: Date;
  }) {
    return this.prisma.messageReceipt.upsert({
      where: {
        messageId_userId: {
          messageId: params.messageId,
          userId: params.userId,
        },
      },
      update: {
        deliveredAt: params.deliveredAt,
      },
      create: {
        messageId: params.messageId,
        userId: params.userId,
        deliveredAt: params.deliveredAt,
      },
    });
  }

  async findConversationMessageById(params: {
    conversationId: string;
    messageId: string;
  }) {
    return this.prisma.message.findFirst({
      where: {
        id: params.messageId,
        conversationId: params.conversationId,
        deletedAt: null,
      },
      include: {
        attachments: {
          orderBy: {
            sortOrder: "asc",
          },
        },
        receipts: true,
      },
    });
  }
}