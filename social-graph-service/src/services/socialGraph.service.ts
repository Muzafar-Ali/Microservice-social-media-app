import { StatusCodes } from 'http-status-codes';
import { SocialGraphRepository } from '../repository/socialGraph.repository.js';
import ApiErrorHandler from '../utils/ApiErrorHandlerClass.js';
import { SocialGraphEventPublisher } from '../events/socialGraph-producer.js';
import { FollowStatus } from '../generated/prisma/enums.js';
import { FollowUserResultDto, UnfollowUserResponseDto } from '../types/social-graph.types.js';

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
  getFollowers(userId: string, query: { cursor?: string; limit?: number }) {}
  getFollowing(userId: string, query: { cursor?: string; limit?: number }) {}
  getCounts(userId: string) {}
  getFollowingUserIds(userId: string) {}
}
