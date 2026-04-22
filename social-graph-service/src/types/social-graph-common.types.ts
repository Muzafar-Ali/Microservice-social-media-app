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