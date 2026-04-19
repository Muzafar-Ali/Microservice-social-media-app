import { NextFunction, Request, response, Response } from 'express';
import { SocialGraphService } from '../services/socialGraph.service.js';
import { FollowUserParamsDto, followUserParamsSchema } from '../validations/socialGraph.validation.js';
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
}
