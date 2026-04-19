import { Follow, FollowStatus, PrismaClient, UserProfileCache } from '../generated/prisma/client.js';

type UpsertUserProjectionInput = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
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

  deleteFollow() {}

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

  findFollowers() {}
  findFollowing() {}
  countFollowers() {}
  countFollowing() {}
  async upsertUserProjection(input: UpsertUserProjectionInput) {
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
  findCachedUsersByIds() {}
}
