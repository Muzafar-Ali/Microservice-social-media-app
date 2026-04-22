// dtos/socialGraph.dto.ts
import { FollowStatus } from '../generated/prisma/enums.js';

export type FollowUserResultDto = {
  followerId: string;
  followeeId: string;
  status: FollowStatus;
  createdAt: Date;
};

export type UnfollowUserResponseDto = {
  followerId: string;
  followeeId: string;
  wasFollowing: boolean;
  removedAt: Date | null;
};

export type FollowerListItemDto = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  followedAt: Date;
};

export type GetFollowersResponseDto = {
  userId: string;
  followers: FollowerListItemDto[];
  nextCursor: string | null;
};

export type GetCountsResponseDto = {
  userId: string;
  followersCount: number;
  followingCount: number;
};

export type GetFollowingUserIdsResponseDto = {
  userId: string;
  followingUserIds: string[];
};

export type UpsertUserProfileCacheInput = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
  isPrivate?: boolean;
};

export type UpsertUserProjectionInput = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
};

export type FindFollowersInput = {
  userId: string;
  cursor?: string;
  limit: number;
};

export type FailedMessageContext = {
  topic: string;
  partition: number;
  offset: string;
  rawValue: string;
  reason: string;
};