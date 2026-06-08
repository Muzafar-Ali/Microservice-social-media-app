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
  UpdateUserStatusDto,
} from './user.validations.js';
import ApiErrorHandler from '../../utils/apiErrorHandlerClass.js';
import formatZodError from '../../utils/formatZodError.js';
import { userCreatedTotal, userUpdatedTotal } from '../../monitoring/user.metrics.js';

export class UserController {
  constructor(private userService: UserService) {}

  createUser = async (req: Request<Record<string, never>, any, CreateUserDto>, res: Response, next: NextFunction) => {
    try {
      const safeData = req.body;

      const user = await this.userService.createUser(safeData);

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
      userUpdatedTotal.inc({ update_type: 'profile_image', });

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
      userUpdatedTotal.inc({ update_type: 'profile' });

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedProfile,
      });
    } catch (error) {
      next(error);
    }
  };

  updateUserStatus = async (
    req: Request<GetUserByIdDto, any, UpdateUserStatusDto>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const safeParams = getUserByIdSchema.safeParse(req.params);

      if (!safeParams.success) {
        throw new ApiErrorHandler(400, formatZodError(safeParams.error));
      }

      const updatedUser = await this.userService.updateUserStatus(safeParams.data.id, req.body.status);
      userUpdatedTotal.inc({ update_type: 'status' });

      res.status(200).json({
        success: true,
        message: 'User status updated successfully',
        data: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  };

  deactivateMyAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;

      if (!userId) {
        throw new ApiErrorHandler(401, 'Unauthorized');
      }

      const updatedUser = await this.userService.deactivateMyAccount(String(userId));
      userUpdatedTotal.inc({ update_type: 'status' });

      res.status(200).json({
        success: true,
        message: 'Account deactivated successfully',
        data: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  };

  reactivateMyAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;

      if (!userId) {
        throw new ApiErrorHandler(401, 'Unauthorized');
      }

      const updatedUser = await this.userService.reactivateMyAccount(String(userId));
      userUpdatedTotal.inc({ update_type: 'status' });

      res.status(200).json({
        success: true,
        message: 'Account reactivated successfully',
        data: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteMyAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;

      if (!userId) {
        throw new ApiErrorHandler(401, 'Unauthorized');
      }

      await this.userService.deleteMyAccount(String(userId));
      userUpdatedTotal.inc({ update_type: 'status' });

      res.status(200).json({
        success: true,
        message: 'Account deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}
