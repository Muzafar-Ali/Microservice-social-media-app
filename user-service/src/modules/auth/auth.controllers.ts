import { NextFunction, Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import {
  ChangePasswordDto,
  changePasswordSchema,
  forgotPasswordSchema,
  ForgotPasswordDto,
  resetPasswordSchema,
  ResetPasswordDto,
  sessionIdParamSchema,
  UserLoginDto,
  userLoginSchema,
} from './auth.validations.js';
import ApiErrorHandler from '../../utils/apiErrorHandlerClass.js';
import formatZodError from '../../utils/formatZodError.js';
import { TLoginContext } from './auth.types.js';
import { clearWebSessionCookie, setWebSessionCookie } from '../../utils/sessionHelpers.js';

export class AuthController {
  constructor(private authService: AuthService) {}

  webLogin = async (
    req: Request<Record<string, never>, any, UserLoginDto>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const safeData = userLoginSchema.safeParse(req.body);

      if (!safeData.success) {
        throw new ApiErrorHandler(400, formatZodError(safeData.error));
      }

      const dto: UserLoginDto = safeData.data;
      const identifier = (dto.email ?? dto.username)!;

      const loginContext: TLoginContext = {
        identifier,
        ip: req.ip,
        userAgent: req.headers['user-agent'] ?? '',
      };

      const user = await this.authService.userLogin(dto, loginContext);

      const sessionId = await this.authService.createSession({
        userId: user.id,
        ip: loginContext.ip,
        userAgent: loginContext.userAgent,
      });

      setWebSessionCookie(res, sessionId);

      res.status(200).json({
        success: true,
        message: 'logged in successfully',
        data: {
          userId: user.id,
          username: user.username,
          email: user.email,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  mobileLogin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const safeData = userLoginSchema.safeParse(req.body);

      if (!safeData.success) {
        throw new ApiErrorHandler(400, formatZodError(safeData.error));
      }

      const dto: UserLoginDto = safeData.data;
      const identifier = (dto.email ?? dto.username)!;

      const loginContext: TLoginContext = {
        identifier,
        ip: req.ip,
        userAgent: req.headers['user-agent'] ?? '',
      };

      const user = await this.authService.userLogin(dto, loginContext);

      const sessionId = await this.authService.createSession({
        userId: user.id,
        ip: loginContext.ip,
        userAgent: loginContext.userAgent,
      });

      res.status(200).json({
        success: true,
        message: 'logged in successfully',
        data: {
          sessionId,
          userId: user.id,
          username: user.username,
          email: user.email,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  webLogout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = req.cookies?.sid ?? req.sessionId;

      if (sessionId) {
        await this.authService.revokeUserSession(String(req.userId), sessionId, { failIfMissing: false });
      }

      clearWebSessionCookie(res);

      res.status(200).json({
        success: true,
        message: 'logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  mobileLogout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      let sessionId = req.sessionId;

      if (authHeader?.startsWith('Bearer ')) {
        sessionId = authHeader.split(' ')[1];
      }

      if (!sessionId) {
        throw new ApiErrorHandler(401, 'Please login');
      }

      await this.authService.revokeUserSession(String(req.userId), sessionId, { failIfMissing: false });

      res.status(200).json({
        success: true,
        message: 'logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  requestPasswordReset = async (
    req: Request<Record<string, never>, any, ForgotPasswordDto>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const safeData = forgotPasswordSchema.safeParse(req.body);

      if (!safeData.success) {
        throw new ApiErrorHandler(400, formatZodError(safeData.error));
      }

      await this.authService.requestPasswordReset(safeData.data);

      res.status(200).json({
        success: true,
        message: 'If an account exists for this email, a password reset link has been sent',
      });
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (
    req: Request<Record<string, never>, any, ResetPasswordDto>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const safeData = resetPasswordSchema.safeParse(req.body);

      if (!safeData.success) {
        throw new ApiErrorHandler(400, formatZodError(safeData.error));
      }

      await this.authService.resetPassword(safeData.data);

      res.status(200).json({
        success: true,
        message: 'Password reset successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (
    req: Request<Record<string, never>, any, ChangePasswordDto>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const safeData = changePasswordSchema.safeParse(req.body);

      if (!safeData.success) {
        throw new ApiErrorHandler(400, formatZodError(safeData.error));
      }

      if (!req.userId) {
        throw new ApiErrorHandler(401, 'Unauthorized');
      }

      await this.authService.changePassword(String(req.userId), safeData.data);

      res.status(200).json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  getSessions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        throw new ApiErrorHandler(401, 'Unauthorized');
      }

      const sessions = await this.authService.listUserSessions(String(req.userId));

      res.status(200).json({
        success: true,
        data: sessions,
      });
    } catch (error) {
      next(error);
    }
  };

  revokeSession = async (req: Request<{ sessionId: string }>, res: Response, next: NextFunction) => {
    try {
      const safeParams = sessionIdParamSchema.safeParse(req.params);

      if (!safeParams.success) {
        throw new ApiErrorHandler(400, formatZodError(safeParams.error));
      }

      if (!req.userId) {
        throw new ApiErrorHandler(401, 'Unauthorized');
      }

      await this.authService.revokeUserSession(String(req.userId), safeParams.data.sessionId);

      if (req.sessionId === safeParams.data.sessionId) {
        clearWebSessionCookie(res);
      }

      res.status(200).json({
        success: true,
        message: 'Session revoked successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  revokeAllSessions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        throw new ApiErrorHandler(401, 'Unauthorized');
      }

      await this.authService.revokeAllUserSessions(String(req.userId));
      clearWebSessionCookie(res);

      res.status(200).json({
        success: true,
        message: 'All sessions revoked successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}
