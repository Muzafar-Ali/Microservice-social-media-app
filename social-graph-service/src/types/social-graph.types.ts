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
