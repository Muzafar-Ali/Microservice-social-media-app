import { StatusCodes } from 'http-status-codes';
import { SocialGraphRepository } from '../repository/socialGraph.repository.js';
import ApiErrorHandler from '../utils/ApiErrorHandlerClass.js';
import { SocialGraphEventPublisher } from '../events/socialGraph-producer.js';
import { FollowStatus } from '../generated/prisma/enums.js';
import { FollowUserResultDto, GetCountsResponseDto, GetFollowersResponseDto, UnfollowUserResponseDto } from '../types/social-graph-common.types.js';

type UpsertUserProfileCacheInput = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
};

export class SocialGraphService {
  constructor(
    private socialGraphRepository: SocialGraphRepository,
    private socialGraphEventPublisher: SocialGraphEventPublisher,
  ) {}

  followUser = async (authenticatedUserId: string, targetUserId: string): Promise<FollowUserResultDto> => {
    if (!authenticatedUserId) {
      throw new ApiErrorHandler(StatusCodes.UNAUTHORIZED, 'Unauthorized');
    }

    if (authenticatedUserId === targetUserId) {
      throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, 'You cannot follow yourself');
    }

    const targetUserProfileCache = await this.socialGraphRepository.findUserProfileCacheByUserId(targetUserId);

    if (!targetUserProfileCache) {
      throw new ApiErrorHandler(StatusCodes.NOT_FOUND, 'Target user is not available in social graph cache yet');
    }

    if (targetUserProfileCache.status !== 'ACTIVE') {
      throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, 'Target user is not active');
    }

    const existingFollowRelation = await this.socialGraphRepository.findFollowRelation(
      authenticatedUserId,
      targetUserId,
    );

    if (existingFollowRelation) {
      throw new ApiErrorHandler(StatusCodes.CONFLICT, 'Follow relation already exists');
    }

    const relationStatus = targetUserProfileCache.isPrivate ? FollowStatus.PENDING : FollowStatus.ACTIVE;

    const createdFollowRelation = await this.socialGraphRepository.createFollowRelation(
      authenticatedUserId,
      targetUserId,
      relationStatus,
    );

    await this.socialGraphEventPublisher.publishFollowCreated({
      followerId: createdFollowRelation.followerId,
      followeeId: createdFollowRelation.followeeId,
      status: createdFollowRelation.status,
      createdAt: createdFollowRelation.createdAt.toISOString(),
    });

    return createdFollowRelation;
  };

  async upsertUserProfileCache(input: UpsertUserProfileCacheInput) {
    return this.socialGraphRepository.upsertUserProfileCache(input);
  }

  unfollowUser = async (authenticatedUserId: string, targetUserId: string): Promise<UnfollowUserResponseDto> => {
    if (!authenticatedUserId) {
      throw new ApiErrorHandler(StatusCodes.UNAUTHORIZED, 'Unauthorized');
    }

    if (authenticatedUserId === targetUserId) {
      throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, 'You cannot unfollow yourself');
    }

    const deletedFollowRelation = await this.socialGraphRepository.deleteFollowRelation(
      authenticatedUserId,
      targetUserId,
    );

    if (!deletedFollowRelation) {
      return {
        followerId: authenticatedUserId,
        followeeId: targetUserId,
        wasFollowing: false,
        removedAt: null,
      };
    }

    if (deletedFollowRelation.status === FollowStatus.ACTIVE) {
      await this.socialGraphEventPublisher.publishFollowRemoved({
        followerId: deletedFollowRelation.followerId,
        followeeId: deletedFollowRelation.followeeId,
        removedAt: new Date().toISOString(),
      });
    }

    return {
      followerId: deletedFollowRelation.followerId,
      followeeId: deletedFollowRelation.followeeId,
      wasFollowing: true,
      removedAt: new Date(),
    };
  };
  getFollowStatus(viewerUserId: string, targetUserId: string) {}

  getFollowers = async (
    userId: string,
    query: { cursor?: string; limit?: number },
  ): Promise<GetFollowersResponseDto> => {
    const targetUserProfileCache = await this.socialGraphRepository.findUserProfileCacheByUserId(userId);

    if (!targetUserProfileCache) {
      throw new ApiErrorHandler(StatusCodes.NOT_FOUND, 'Target user is not available in social graph cache yet');
    }

    const limit = query.limit ?? 20;

    const followerRelations = await this.socialGraphRepository.findFollowers({
      userId,
      cursor: query.cursor,
      limit,
    });

    const hasMore = followerRelations.length > limit;
    const paginatedFollowerRelations = hasMore ? followerRelations.slice(0, limit) : followerRelations;

    const followerUserIds = paginatedFollowerRelations.map((relation) => relation.followerId);

    const cachedFollowers = await this.socialGraphRepository.findCachedUsersByIds(followerUserIds);

    const cachedFollowersMap = new Map(
      cachedFollowers.map((cachedFollower) => [cachedFollower.userId, cachedFollower]),
    );

    const followers = paginatedFollowerRelations
      .map((relation) => {
        const cachedFollower = cachedFollowersMap.get(relation.followerId);

        if (!cachedFollower) {
          return null;
        }

        return {
          userId: cachedFollower.userId,
          username: cachedFollower.username,
          displayName: cachedFollower.displayName,
          avatarUrl: cachedFollower.avatarUrl,
          followedAt: relation.createdAt,
        };
      })
      .filter((follower): follower is NonNullable<typeof follower> => follower !== null);

    const nextCursor = hasMore ? (paginatedFollowerRelations[paginatedFollowerRelations.length - 1]?.id ?? null) : null;

    return {
      userId,
      followers,
      nextCursor,
    };
  };

  getFollowing(userId: string, query: { cursor?: string; limit?: number }) {}
  
  getCounts = async (userId: string): Promise<GetCountsResponseDto> => {
    const targetUserProfileCache = await this.socialGraphRepository.findUserProfileCacheByUserId(userId);

    if (!targetUserProfileCache) {
      throw new ApiErrorHandler(StatusCodes.NOT_FOUND, 'Target user is not available in social graph cache yet');
    }

    const [followersCount, followingCount] = await Promise.all([
      this.socialGraphRepository.countFollowers(userId),
      this.socialGraphRepository.countFollowing(userId),
    ]);

    return {
      userId,
      followersCount,
      followingCount,
    };
  };

  getFollowingUserIds(userId: string) {}
}
