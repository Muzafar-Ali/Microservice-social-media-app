import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service.js';
import {
  CreateUserDto,
  GetUserByIdDto,
  getUserByIdSchema,
  GetUserByUsernameDto,
  getUserByUsernameSchema,
  UpdateMyProfileDto,
  UpdateProfileImageDto,
} from './user.validations.js';
import ApiErrorHandler from '../../utils/apiErrorHandlerClass.js';
import formatZodError from '../../utils/formatZodError.js';
import { userCreatedCounter, userUpdatedCounter } from '../../monitoring/metrics.js';

export class UserController {
  constructor(private userService: UserService) {}

  createUser = async (req: Request<Record<string, never>, any, CreateUserDto>, res: Response, next: NextFunction) => {
    try {
      const safeData = req.body;

      const user = await this.userService.createUser(safeData);
      userCreatedCounter.inc();

      res.status(201).json({
        success: true,
        message: 'user created successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  getProfileById = async (req: Request<GetUserByIdDto>, res: Response, next: NextFunction) => {
    try {
      const safeParams = getUserByIdSchema.safeParse(req.params);

      if (!safeParams.success) {
        throw new ApiErrorHandler(400, formatZodError(safeParams.error));
      }

      const profile = await this.userService.getUserById(safeParams.data.id);

      if (!profile) {
        throw new ApiErrorHandler(404, 'user not found');
      }

      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  };

  getProfileByUsername = async (req: Request<GetUserByUsernameDto>, res: Response, next: NextFunction) => {
    try {
      const safeParams = getUserByUsernameSchema.safeParse(req.params);

      if (!safeParams.success) {
        throw new ApiErrorHandler(400, formatZodError(safeParams.error));
      }

      const profile = await this.userService.getUserByUsername(safeParams.data.username);

      if (!profile) {
        throw new ApiErrorHandler(404, 'user not found');
      }

      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  };

  updateProfileImage = async (
    req: Request<Record<string, never>, any, UpdateProfileImageDto>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const safeData = req.body;
      const userId = req.userId;

      await this.userService.updateUserProfileImage(safeData, String(userId));
      userUpdatedCounter.inc({ update_type: 'profile_image' });

      res.status(200).json({
        success: true,
        message: 'Profile image updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  updateMyProfile = async (
    req: Request<Record<string, any>, any, UpdateMyProfileDto>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const safeData = req.body;
      const userId = req.userId;

      if (!userId) {
        throw new ApiErrorHandler(401, 'Unauthorized');
      }

      const updatedProfile = await this.userService.updateMyProfile(String(userId), safeData);
      userUpdatedCounter.inc({ update_type: 'profile' });

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedProfile,
      });
    } catch (error) {
      next(error);
    }
  };
}
