import { SocialGraphRepository } from "../repository/social.graph.repository.js";

export class SocialGraphService {

  constructor(private socialGraphRepository: SocialGraphRepository) {}

  followUser(authenticatedUserId: string, targetUserId: string) {}
  unfollowUser(authenticatedUserId: string, targetUserId: string) {}
  getFollowStatus(viewerUserId: string, targetUserId: string) {}
  getFollowers(userId: string, query: { cursor?: string; limit?: number }) {}
  getFollowing(userId: string, query: { cursor?: string; limit?: number }) {}
  getCounts(userId: string) {}
  getFollowingUserIds(userId: string) {}
  upsertUserProfileCache(payload) {}
  
}