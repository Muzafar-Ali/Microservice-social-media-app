import { NextFunction, Request, Response } from 'express';
import { SocialGraphService } from '../services/socialGraph.service.ts.js';
import { FollowTargetParamsDto, followTargetParamsSchema } from '../validations/socialGraph.validation.js';
import ApiErrorHandler from '../utils/ApiErrorHandlerClass.js';
import formatZodError from '../utils/formatZodError.js';
import { FollowStatus } from '../generated/prisma/enums.js';
import { StatusCodes } from 'http-status-codes';

export class SocialGraphController {
  constructor(private socialGraphService: SocialGraphService) {}

  followUser = async (req: Request<FollowTargetParamsDto>, res: Response, next: NextFunction) => {
    try {
      const authenticatedUserId = req.userId;

      if (!authenticatedUserId) {
        throw new ApiErrorHandler(StatusCodes.UNAUTHORIZED, 'Unauthorized');
      }

      const safeParams = followTargetParamsSchema.safeParse(req.params);

      if (!safeParams.success) {
        throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, formatZodError(safeParams.error));
      }

      const followResult = await this.socialGraphService.followUser(authenticatedUserId, safeParams.data.targetUserId);

      res.status(StatusCodes.CREATED).json({
        success: true,
        message:
          followResult.status === FollowStatus.PENDING ? 'Follow request sent successfully' : 'Followed successfully',
        data: {
          followerId: followResult.followerId,
          followeeId: followResult.followeeId,
          status: followResult.status,
          createdAt: followResult.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
