import { StatusCodes } from 'http-status-codes';
import { SocialGraphRepository } from '../repository/socialGraph.repository.js';
import ApiErrorHandler from '../utils/ApiErrorHandlerClass.js';
import { SocialGraphEventPublisher } from '../events/socialGraph-producer.js';
import { FollowStatus } from '../generated/prisma/enums.js';

type UpsertUserProjectionInput = {
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

  followUser = async (authenticatedUserId: string, targetUserId: string) => {
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

  async upsertUserProjection(input: UpsertUserProjectionInput) {
    return this.socialGraphRepository.upsertUserProjection(input);
  }
  unfollowUser(authenticatedUserId: string, targetUserId: string) {}
  getFollowStatus(viewerUserId: string, targetUserId: string) {}
  getFollowers(userId: string, query: { cursor?: string; limit?: number }) {}
  getFollowing(userId: string, query: { cursor?: string; limit?: number }) {}
  getCounts(userId: string) {}
  getFollowingUserIds(userId: string) {}
  upsertUserProfileCache(payload: any) {}
}
