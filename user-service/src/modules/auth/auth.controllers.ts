import { NextFunction, Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { UserLoginDto, userLoginSchema } from './auth.validations.js';
import ApiErrorHandler from '../../utils/apiErrorHandlerClass.js';
import formatZodError from '../../utils/formatZodError.js';
import { TLoginContext } from './auth.types.js';
import {
  clearWebSessionCookie,
  createWebSession,
  deleteSession,
  setWebSessionCookie,
} from '../../utils/sessionHelpers.js';

export class AuthController {
  constructor(private authService: AuthService) {}

  webLoginHandler = async (
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

      const sessionId = await createWebSession({
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

  mobileLoginHandler = async (req: Request, res: Response, next: NextFunction) => {
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

      const sessionId = await createWebSession({
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

  webLogoutHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = req.cookies?.sid;

      if (sessionId) {
        await deleteSession(sessionId);
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

  mobileLogoutHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      let sessionId: string | undefined;

      if (authHeader?.startsWith('Bearer ')) {
        sessionId = authHeader.split(' ')[1];
      }

      if (!sessionId) {
        throw new ApiErrorHandler(401, 'Please login');
      }

      await deleteSession(sessionId);

      res.status(200).json({
        success: true,
        message: 'logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}
