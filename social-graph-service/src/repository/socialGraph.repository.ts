import {
  Follow,
  FollowStatus,
  PrismaClient,
  UserProfileCache,
} from '../generated/prisma/client.js';

export class SocialGraphRepository {
  constructor(private prisma: PrismaClient) {}

  findUserProfileCacheByUserId = async (userId: string): Promise<UserProfileCache | null> => {
    return this.prisma.userProfileCache.findUnique({
      where: { userId },
    });
  };

  createFollow() {}
  createFollowRelation = async (
    followerId: string,
    followeeId: string,
    status: FollowStatus,
  ): Promise<Follow> => {
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
  upsertUserProfileCache() {}
  findCachedUserById() {}
  findCachedUsersByIds() {}
}
