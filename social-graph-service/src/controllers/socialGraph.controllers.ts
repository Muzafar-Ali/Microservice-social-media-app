import { NextFunction, Request, response, Response } from 'express';
import { SocialGraphService } from '../services/socialGraph.service.js';
import {
  CursorPaginationQueryDto,
  cursorPaginationQuerySchema,
  FollowUserParamsDto,
  followUserParamsSchema,
} from '../validations/socialGraph.validation.js';
import ApiErrorHandler from '../utils/ApiErrorHandlerClass.js';
import formatZodError from '../utils/formatZodError.js';
import { FollowStatus } from '../generated/prisma/enums.js';
import { StatusCodes } from 'http-status-codes';

export class SocialGraphController {
  constructor(private socialGraphService: SocialGraphService) {}

  followUser = async (req: Request<FollowUserParamsDto>, res: Response, next: NextFunction) => {
    try {
      const { userId } = req;
      
      if (!userId) {
        throw new ApiErrorHandler(StatusCodes.UNAUTHORIZED, 'Unauthorized');
      }

      const safeParams = followUserParamsSchema.safeParse(req.params);

      if (!safeParams.success) {
        throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, formatZodError(safeParams.error));
      }

      const followResult = await this.socialGraphService.followUser(userId, safeParams.data.targetUserId);

      res.status(StatusCodes.CREATED).json({
        success: true,
        message:
          followResult.status === FollowStatus.PENDING ? 'Follow request sent successfully' : 'Followed successfully',
        data: followResult,
      });
    } catch (error) {
      next(error);
    }
  };

  unfollowUser = async (req: Request<FollowUserParamsDto>, res: Response, next: NextFunction) => {
    try {
      const { userId } = req;

      if (!userId) {
        throw new ApiErrorHandler(StatusCodes.UNAUTHORIZED, 'Unauthorized');
      }

      const safeParams = followUserParamsSchema.safeParse(req.params);

      if (!safeParams.success) {
        throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, formatZodError(safeParams.error));
      }

      const unfollowResult = await this.socialGraphService.unfollowUser(userId, safeParams.data.targetUserId);

      res.status(200).json({
        success: true,
        message: unfollowResult.wasFollowing ? 'Unfollowed successfully' : 'Follow relation does not exist',
        data: unfollowResult,
      });
    } catch (error) {
      next(error);
    }
  };

  getFollowers = async (
    req: Request<FollowUserParamsDto, unknown, unknown, CursorPaginationQueryDto>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      console.log('param', req.params)
      const safeParams = followUserParamsSchema.safeParse(req.params);

      if (!safeParams.success) {
        throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, formatZodError(safeParams.error));
      }

      const safeQuery = cursorPaginationQuerySchema.safeParse(req.query);

      if (!safeQuery.success) {
        throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, formatZodError(safeQuery.error));
      }

      const followersResult = await this.socialGraphService.getFollowers(safeParams.data.targetUserId, safeQuery.data);

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Followers fetched successfully',
        data: followersResult,
      });
    } catch (error) {
      next(error);
    }
  };

  getCounts = async (req: Request<FollowUserParamsDto>, res: Response, next: NextFunction) => {
    try {
      const safeParams = followUserParamsSchema.safeParse(req.params);

      if (!safeParams.success) {
        throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, formatZodError(safeParams.error));
      }

      const countsResult = await this.socialGraphService.getCounts(safeParams.data.targetUserId);

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Counts fetched successfully',
        data: countsResult,
      });
    } catch (error) {
      next(error);
    }
  };

  getMyFollowingUserIds = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req;

      if (!userId) {
        throw new ApiErrorHandler(StatusCodes.UNAUTHORIZED, 'Unauthorized');
      }

      const followingUserIdsResult = await this.socialGraphService.getFollowingUserIds(userId);

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Following user ids fetched successfully',
        data: followingUserIdsResult,
      });
    } catch (error) {
      next(error);
    }
  };
}
