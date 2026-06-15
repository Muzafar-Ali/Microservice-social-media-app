import crypto from 'node:crypto';
import { SOCIAL_GRAPH_EVENT_NAMES } from '../events/socialGraph-event.topics.js';
import { Follow, FollowStatus, PrismaClient, UserProfileCache, Prisma } from '../generated/prisma/client.js';
import {
  ApplyUserProfileEventInput,
  FindFollowersInput,
  UpsertUserProjectionInput,
} from '../types/social-graph-common.types.js';
import { FollowCreatedPayload, UnFollowCreatedPayload } from '../types/social-graph-event-publisher.types.js';

export class SocialGraphRepository {
  constructor(private prisma: PrismaClient) {}

  findUserProfileCacheByUserId = async (userId: string): Promise<UserProfileCache | null> => {
    return this.prisma.userProfileCache.findUnique({
      where: { userId },
    });
  };

  findFollowRelation = async (followerId: string, followeeId: string): Promise<Follow | null> => {
    return this.prisma.follow.findUnique({
      where: {
        followerId_followeeId: {
          followerId,
          followeeId,
        },
      },
    });
  };

  createFollowRelationAndQueueFollowCreatedEvent = async (
    followerId: string,
    followeeId: string,
    status: FollowStatus,
  ): Promise<Follow> => {
    return this.prisma.$transaction(async (transactionClient: Prisma.TransactionClient) => {
      const createdFollowRelation = await transactionClient.follow.create({
        data: {
          followerId,
          followeeId,
          status,
        },
      });

      const eventName =
        status === FollowStatus.PENDING
          ? SOCIAL_GRAPH_EVENT_NAMES.FOLLOW_REQUESTED
          : SOCIAL_GRAPH_EVENT_NAMES.FOLLOW_CREATED;

      const payload: FollowCreatedPayload = {
        followerId: createdFollowRelation.followerId,
        followeeId: createdFollowRelation.followeeId,
        status: createdFollowRelation.status,
        createdAt: createdFollowRelation.createdAt.toISOString(),
      };

      await transactionClient.outboxEvent.create({
        data: {
          eventId: crypto.randomUUID(),
          eventName,
          eventVersion: 1,
          aggregateId: createdFollowRelation.id,
          partitionKey: createdFollowRelation.followerId,
          payload,
          producerService: 'social-graph-service',
          occurredAt: new Date(),
          status: 'PENDING',
        },
      });

      return createdFollowRelation;
    });
  };

  deleteFollowRelationAndQueueFollowRemovedEvent = async (
    followerId: string,
    followeeId: string,
  ): Promise<Follow | null> => {
    return this.prisma.$transaction(async (transactionClient: Prisma.TransactionClient) => {
      const existingFollowRelation = await transactionClient.follow.findUnique({
        where: {
          followerId_followeeId: {
            followerId,
            followeeId,
          },
        },
      });

      if (!existingFollowRelation) {
        return null;
      }

      const deletedFollowRelation = await transactionClient.follow.delete({
        where: {
          followerId_followeeId: {
            followerId,
            followeeId,
          },
        },
      });

      if (deletedFollowRelation.status === FollowStatus.ACTIVE) {
        const payload: UnFollowCreatedPayload = {
          followerId: deletedFollowRelation.followerId,
          followeeId: deletedFollowRelation.followeeId,
          removedAt: new Date().toISOString(),
        };

        await transactionClient.outboxEvent.create({
          data: {
            eventId: crypto.randomUUID(),
            eventName: SOCIAL_GRAPH_EVENT_NAMES.FOLLOW_REMOVED,
            eventVersion: 1,
            aggregateId: deletedFollowRelation.id,
            partitionKey: deletedFollowRelation.followerId,
            payload,
            producerService: 'social-graph-service',
            occurredAt: new Date(),
            status: 'PENDING',
          },
        });
      }

      return deletedFollowRelation;
    });
  };

  acceptFollowRequestAndQueueEvent = async (
    requesterUserId: string,
    authenticatedUserId: string,
  ): Promise<Follow | null> => {
    return this.prisma.$transaction(async (transactionClient: Prisma.TransactionClient) => {
      const pendingRequest = await transactionClient.follow.findUnique({
        where: {
          followerId_followeeId: {
            followerId: requesterUserId,
            followeeId: authenticatedUserId,
          },
        },
      });

      if (!pendingRequest || pendingRequest.status !== FollowStatus.PENDING) {
        return null;
      }

      const acceptedFollow = await transactionClient.follow.update({
        where: {
          followerId_followeeId: {
            followerId: requesterUserId,
            followeeId: authenticatedUserId,
          },
        },
        data: {
          status: FollowStatus.ACTIVE,
        },
      });

      const payload: FollowCreatedPayload = {
        followerId: acceptedFollow.followerId,
        followeeId: acceptedFollow.followeeId,
        status: acceptedFollow.status,
        createdAt: acceptedFollow.createdAt.toISOString(),
      };

      await transactionClient.outboxEvent.create({
        data: {
          eventId: crypto.randomUUID(),
          eventName: SOCIAL_GRAPH_EVENT_NAMES.FOLLOW_ACCEPTED,
          eventVersion: 1,
          aggregateId: acceptedFollow.id,
          partitionKey: acceptedFollow.followerId,
          payload,
          producerService: 'social-graph-service',
          occurredAt: new Date(),
          status: 'PENDING',
        },
      });

      return acceptedFollow;
    });
  };

  rejectFollowRequest = async (requesterUserId: string, authenticatedUserId: string): Promise<boolean> => {
    const result = await this.prisma.follow.deleteMany({
      where: {
        followerId: requesterUserId,
        followeeId: authenticatedUserId,
        status: FollowStatus.PENDING,
      },
    });

    return result.count > 0;
  };

  findFollowers = async ({ userId, cursor, limit }: FindFollowersInput): Promise<Follow[]> => {
    return this.prisma.follow.findMany({
      where: {
        followeeId: userId,
        status: FollowStatus.ACTIVE,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
    });
  };

  countFollowers = async (userId: string): Promise<number> => {
    return this.prisma.follow.count({
      where: {
        followeeId: userId,
        status: FollowStatus.ACTIVE,
      },
    });
  };

  countFollowing = async (userId: string): Promise<number> => {
    return this.prisma.follow.count({
      where: {
        followerId: userId,
        status: FollowStatus.ACTIVE,
      },
    });
  };

  async upsertUserProfileCache(input: UpsertUserProjectionInput): Promise<UserProfileCache> {
    return this.prisma.userProfileCache.upsert({
      where: {
        userId: input.userId,
      },
      update: {
        username: input.username,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
        status: input.status,
        isPrivate: input.isPrivate,
      },
      create: {
        userId: input.userId,
        username: input.username,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
        status: input.status,
        isPrivate: input.isPrivate,
      },
    });
  }

  async applyUserProfileEvent(input: ApplyUserProfileEventInput): Promise<boolean> {
    return this.prisma.$transaction(async (transactionClient: Prisma.TransactionClient) => {
      const insertedRows = await transactionClient.$executeRaw`
        INSERT INTO "ProcessedEvent" (
          "id",
          "eventId",
          "consumerName",
          "processedAt"
        )
        VALUES (
          ${crypto.randomUUID()}::uuid,
          ${input.eventId},
          'social-graph-service:user-profile-projection',
          NOW()
        )
        ON CONFLICT ("eventId", "consumerName") DO NOTHING
      `;

      if (insertedRows === 0) {
        return false;
      }

      await transactionClient.userProfileCache.upsert({
        where: {
          userId: input.userId,
        },
        update: {
          username: input.username,
          displayName: input.displayName,
          avatarUrl: input.avatarUrl,
          status: input.status,
          isPrivate: input.isPrivate,
        },
        create: {
          userId: input.userId,
          username: input.username,
          displayName: input.displayName,
          avatarUrl: input.avatarUrl,
          status: input.status,
          isPrivate: input.isPrivate,
        },
      });

      return true;
    });
  }

  findCachedUsersByIds = async (userIds: string[]): Promise<UserProfileCache[]> => {
    if (userIds.length === 0) {
      return [];
    }

    return this.prisma.userProfileCache.findMany({
      where: {
        userId: {
          in: userIds,
        },
      },
    });
  };

  findFollowingUserIds = async (userId: string): Promise<string[]> => {
    const followingRelations = await this.prisma.follow.findMany({
      where: {
        followerId: userId,
        status: FollowStatus.ACTIVE,
      },
      select: {
        followeeId: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    return followingRelations.map((relation: any) => relation.followeeId);
  };
}
