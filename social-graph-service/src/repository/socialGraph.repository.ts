import { Follow, FollowStatus, PrismaClient, UserProfileCache } from '../generated/prisma/client.js';

type UpsertUserProjectionInput = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
};

type FindFollowersInput = {
  userId: string;
  cursor?: string;
  limit: number;
};

export class SocialGraphRepository {
  constructor(private prisma: PrismaClient) {}

  findUserProfileCacheByUserId = async (userId: string): Promise<UserProfileCache | null> => {
    return this.prisma.userProfileCache.findUnique({
      where: { userId },
    });
  };

  createFollow() {}

  createFollowRelation = async (followerId: string, followeeId: string, status: FollowStatus): Promise<Follow> => {
    return this.prisma.follow.create({
      data: {
        followerId,
        followeeId,
        status,
      },
    });
  };

  deleteFollowRelation = async (followerId: string, followeeId: string): Promise<Follow | null> => {
    const existingFollowRelation = await this.prisma.follow.findUnique({
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

    return this.prisma.follow.delete({
      where: {
        followerId_followeeId: {
          followerId,
          followeeId,
        },
      },
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

  findFollowing() {}
  
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

  findCachedUserById() {}

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
}
