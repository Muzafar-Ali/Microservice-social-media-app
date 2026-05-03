import crypto from 'node:crypto';
import { SOCIAL_GRAPH_EVENT_NAMES } from '../events/socialGraph-event.topics.js';
import { Follow, FollowStatus, PrismaClient, UserProfileCache, Prisma } from '../generated/prisma/client.js';
import { FindFollowersInput, UpsertUserProjectionInput } from '../types/social-graph-common.types.js';
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
      },
      create: {
        userId: input.userId,
        username: input.username,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
        status: input.status,
      },
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
