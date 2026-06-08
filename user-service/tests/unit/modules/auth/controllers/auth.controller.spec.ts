import { jest } from '@jest/globals';
import { NextFunction, Request, Response } from 'express';

jest.mock('../../../../../src/utils/sessionHelpers.js', () => ({
  setWebSessionCookie: jest.fn(),
  clearWebSessionCookie: jest.fn(),
}));

import { AuthController } from '../../../../../src/modules/auth/auth.controllers.js';
import { clearWebSessionCookie, setWebSessionCookie } from '../../../../../src/utils/sessionHelpers.js';
import {
  createChangePasswordDto,
  createForgotPasswordDto,
  createSession,
  createUser,
  createUserLoginDto,
} from '../../../../factories/auth.factory.js';

type AuthUser = ReturnType<typeof createUser>;
type AuthSession = ReturnType<typeof createSession>;

type MockRequestOverrides<TRequest extends Request> = Partial<TRequest> & {
  body?: unknown;
  params?: unknown;
  query?: unknown;
  headers?: Record<string, string | undefined>;
  cookies?: Record<string, string | undefined>;
  userId?: string;
  sessionId?: string;
  ip?: string;
};

const createMockRequest = <TRequest extends Request>(overrides: MockRequestOverrides<TRequest> = {}): TRequest =>
  ({
    body: {},
    params: {},
    query: {},
    headers: {},
    cookies: {},
    ip: '127.0.0.1',
    ...overrides,
  }) as unknown as TRequest;

describe('AuthController', () => {
  const mockAuthService = {
    userLogin: jest.fn<() => Promise<AuthUser>>(),
    createSession: jest.fn<() => Promise<string>>(),
    revokeUserSession: jest.fn<() => Promise<void>>(),
    requestPasswordReset: jest.fn<() => Promise<void>>(),
    resetPassword: jest.fn<() => Promise<void>>(),
    changePassword: jest.fn<() => Promise<void>>(),
    listUserSessions: jest.fn<() => Promise<AuthSession[]>>(),
    revokeAllUserSessions: jest.fn<() => Promise<void>>(),
  };

  let authController: AuthController;
  let res: Response;
  let next: jest.Mock;

  const status = jest.fn();
  const json = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthService.userLogin.mockReset();
    mockAuthService.createSession.mockReset();
    mockAuthService.revokeUserSession.mockReset();
    mockAuthService.requestPasswordReset.mockReset();
    mockAuthService.resetPassword.mockReset();
    mockAuthService.changePassword.mockReset();
    mockAuthService.listUserSessions.mockReset();
    mockAuthService.revokeAllUserSessions.mockReset();

    mockAuthService.userLogin.mockResolvedValue(createUser());
    mockAuthService.createSession.mockResolvedValue('session-123');
    mockAuthService.revokeUserSession.mockResolvedValue(undefined);
    mockAuthService.requestPasswordReset.mockResolvedValue(undefined);
    mockAuthService.resetPassword.mockResolvedValue(undefined);
    mockAuthService.changePassword.mockResolvedValue(undefined);
    mockAuthService.listUserSessions.mockResolvedValue([]);
    mockAuthService.revokeAllUserSessions.mockResolvedValue(undefined);

    authController = new AuthController(mockAuthService as never);

    status.mockReset();
    json.mockReset();

    status.mockReturnValue({ json });

    res = {
      status,
      json,
    } as unknown as Response;

    next = jest.fn();
  });

  describe('webLogin', () => {
    it('logs in web user, creates session, sets web cookie, and returns public user data', async () => {
      const loginDto = createUserLoginDto();

      const req = createMockRequest<Parameters<AuthController['webLogin']>[0]>({
        body: loginDto,
        ip: '127.0.0.1',
        headers: {
          'user-agent': 'jest-agent',
        },
      });

      mockAuthService.userLogin.mockResolvedValue(
        createUser({
          id: 'user-1',
          username: 'testuser',
          email: 'user@example.com',
        }),
      );

      mockAuthService.createSession.mockResolvedValue('session-123');

      await authController.webLogin(req, res, next as unknown as NextFunction);

      expect(mockAuthService.userLogin).toHaveBeenCalledWith(loginDto, {
        identifier: 'user@example.com',
        ip: '127.0.0.1',
        userAgent: 'jest-agent',
      });

      expect(mockAuthService.createSession).toHaveBeenCalledWith({
        userId: 'user-1',
        ip: '127.0.0.1',
        userAgent: 'jest-agent',
      });

      expect(setWebSessionCookie).toHaveBeenCalledWith(res, 'session-123');

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith({
        success: true,
        message: 'logged in successfully',
        data: {
          userId: 'user-1',
          username: 'testuser',
          email: 'user@example.com',
        },
      });

      expect(next).not.toHaveBeenCalled();
    });

    it('uses username as identifier when web login uses username instead of email', async () => {
      const loginDto = createUserLoginDto({
        email: undefined,
        username: 'testuser',
      });

      const req = createMockRequest<Parameters<AuthController['webLogin']>[0]>({
        body: loginDto,
        headers: {
          'user-agent': 'jest-agent',
        },
      });

      mockAuthService.userLogin.mockResolvedValue(createUser());
      mockAuthService.createSession.mockResolvedValue('session-123');

      await authController.webLogin(req, res, next as unknown as NextFunction);

      expect(mockAuthService.userLogin).toHaveBeenCalledWith(loginDto, {
        identifier: 'testuser',
        ip: '127.0.0.1',
        userAgent: 'jest-agent',
      });
    });

    it('passes login service error to next and does not create session or set cookie', async () => {
      const req = createMockRequest<Parameters<AuthController['webLogin']>[0]>({
        body: createUserLoginDto(),
        headers: {
          'user-agent': 'jest-agent',
        },
      });

      const serviceError = new Error('Invalid credentials');
      mockAuthService.userLogin.mockRejectedValue(serviceError);

      await authController.webLogin(req, res, next as unknown as NextFunction);

      expect(mockAuthService.userLogin).toHaveBeenCalledTimes(1);
      expect(mockAuthService.createSession).not.toHaveBeenCalled();
      expect(setWebSessionCookie).not.toHaveBeenCalled();
      expect(status).not.toHaveBeenCalled();
      expect(json).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(serviceError);
    });

    it('passes session creation error to next and does not set cookie or send response', async () => {
      const req = createMockRequest<Parameters<AuthController['webLogin']>[0]>({
        body: createUserLoginDto(),
        headers: {
          'user-agent': 'jest-agent',
        },
      });

      const sessionError = new Error('Session creation failed');

      mockAuthService.userLogin.mockResolvedValue(createUser());
      mockAuthService.createSession.mockRejectedValue(sessionError);

      await authController.webLogin(req, res, next as unknown as NextFunction);

      expect(mockAuthService.createSession).toHaveBeenCalledWith({
        userId: 'user-1',
        ip: '127.0.0.1',
        userAgent: 'jest-agent',
      });

      expect(setWebSessionCookie).not.toHaveBeenCalled();
      expect(status).not.toHaveBeenCalled();
      expect(json).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(sessionError);
    });
  });

  describe('mobileLogin', () => {
    it('logs in mobile user and returns session id in response body', async () => {
      const req = createMockRequest<Request>({
        body: {
          username: 'testuser1',
          password: 'password123',
        },
        ip: '127.0.0.1',
        headers: {
          'user-agent': 'mobile-agent',
        },
      });

      mockAuthService.userLogin.mockResolvedValue(
        createUser({
          id: 'user-1',
          username: 'testuser1',
          email: 'user@example.com',
        }),
      );

      mockAuthService.createSession.mockResolvedValue('session-123');

      await authController.mobileLogin(req, res, next as unknown as NextFunction);

      expect(mockAuthService.userLogin).toHaveBeenCalledWith(
        {
          username: 'testuser1',
          password: 'password123',
        },
        {
          identifier: 'testuser1',
          ip: '127.0.0.1',
          userAgent: 'mobile-agent',
        },
      );

      expect(mockAuthService.createSession).toHaveBeenCalledWith({
        userId: 'user-1',
        ip: '127.0.0.1',
        userAgent: 'mobile-agent',
      });

      expect(setWebSessionCookie).not.toHaveBeenCalled();

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith({
        success: true,
        message: 'logged in successfully',
        data: {
          sessionId: 'session-123',
          userId: 'user-1',
          username: 'testuser1',
          email: 'user@example.com',
        },
      });

      expect(next).not.toHaveBeenCalled();
    });

    it('does not call service when mobile login payload is invalid', async () => {
      const req = createMockRequest<Request>({
        body: {
          username: 'invalid$user',
          password: 'password123',
        },
      });

      await authController.mobileLogin(req, res, next as unknown as NextFunction);

      expect(mockAuthService.userLogin).not.toHaveBeenCalled();
      expect(mockAuthService.createSession).not.toHaveBeenCalled();
      expect(status).not.toHaveBeenCalled();
      expect(json).not.toHaveBeenCalled();

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
        }),
      );
    });
  });

  describe('webLogout', () => {
    it('revokes cookie session, clears cookie, and returns success', async () => {
      const req = createMockRequest<Request>({
        cookies: {
          sid: 'session-123',
        },
        userId: 'user-1',
      });

      await authController.webLogout(req, res, next as unknown as NextFunction);

      expect(mockAuthService.revokeUserSession).toHaveBeenCalledWith('user-1', 'session-123', { failIfMissing: false });

      expect(clearWebSessionCookie).toHaveBeenCalledWith(res);
      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith({
        success: true,
        message: 'logged out successfully',
      });

      expect(next).not.toHaveBeenCalled();
    });

    it('falls back to request session id when cookie session id is missing', async () => {
      const req = createMockRequest<Request>({
        cookies: {},
        sessionId: 'fallback-session',
        userId: 'user-1',
      });

      await authController.webLogout(req, res, next as unknown as NextFunction);

      expect(mockAuthService.revokeUserSession).toHaveBeenCalledWith('user-1', 'fallback-session', {
        failIfMissing: false,
      });

      expect(clearWebSessionCookie).toHaveBeenCalledWith(res);
      expect(status).toHaveBeenCalledWith(200);
    });

    it('clears cookie without revoking when no session id exists', async () => {
      const req = createMockRequest<Request>({
        cookies: {},
        userId: 'user-1',
      });

      await authController.webLogout(req, res, next as unknown as NextFunction);

      expect(mockAuthService.revokeUserSession).not.toHaveBeenCalled();
      expect(clearWebSessionCookie).toHaveBeenCalledWith(res);

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith({
        success: true,
        message: 'logged out successfully',
      });

      expect(next).not.toHaveBeenCalled();
    });

    it('passes revoke error to next and does not clear cookie or send response', async () => {
      const req = createMockRequest<Request>({
        cookies: {
          sid: 'session-123',
        },
        userId: 'user-1',
      });

      const revokeError = new Error('Revoke failed');
      mockAuthService.revokeUserSession.mockRejectedValue(revokeError);

      await authController.webLogout(req, res, next as unknown as NextFunction);

      expect(clearWebSessionCookie).not.toHaveBeenCalled();
      expect(status).not.toHaveBeenCalled();
      expect(json).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(revokeError);
    });
  });

  describe('mobileLogout', () => {
    it('revokes bearer session and returns success', async () => {
      const req = createMockRequest<Request>({
        headers: {
          authorization: 'Bearer session-123',
        },
        userId: 'user-1',
      });

      await authController.mobileLogout(req, res, next as unknown as NextFunction);

      expect(mockAuthService.revokeUserSession).toHaveBeenCalledWith('user-1', 'session-123', { failIfMissing: false });

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith({
        success: true,
        message: 'logged out successfully',
      });

      expect(next).not.toHaveBeenCalled();
    });

    it('uses request session id when bearer authorization header is missing', async () => {
      const req = createMockRequest<Request>({
        sessionId: 'request-session',
        userId: 'user-1',
      });

      await authController.mobileLogout(req, res, next as unknown as NextFunction);

      expect(mockAuthService.revokeUserSession).toHaveBeenCalledWith('user-1', 'request-session', {
        failIfMissing: false,
      });

      expect(status).toHaveBeenCalledWith(200);
    });

    it('does not revoke session when mobile session id is missing', async () => {
      const req = createMockRequest<Request>({
        userId: 'user-1',
      });

      await authController.mobileLogout(req, res, next as unknown as NextFunction);

      expect(mockAuthService.revokeUserSession).not.toHaveBeenCalled();
      expect(status).not.toHaveBeenCalled();
      expect(json).not.toHaveBeenCalled();

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'Please login',
        }),
      );
    });
  });

  describe('requestPasswordReset', () => {
    it('passes email from validated body to service and returns generic response', async () => {
      const forgotPasswordDto = createForgotPasswordDto();

      const req = createMockRequest<Parameters<AuthController['requestPasswordReset']>[0]>({
        body: forgotPasswordDto,
      });

      await authController.requestPasswordReset(req, res, next as unknown as NextFunction);

      expect(mockAuthService.requestPasswordReset).toHaveBeenCalledWith({
        email: 'user@example.com',
      });

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith({
        success: true,
        message: 'If an account exists for this email, a password reset link has been sent',
      });

      expect(next).not.toHaveBeenCalled();
    });

    it('passes password reset request service error to next and does not send response', async () => {
      const req = createMockRequest<Parameters<AuthController['requestPasswordReset']>[0]>({
        body: createForgotPasswordDto(),
      });

      const serviceError = new Error('Email service unavailable');
      mockAuthService.requestPasswordReset.mockRejectedValue(serviceError);

      await authController.requestPasswordReset(req, res, next as unknown as NextFunction);

      expect(status).not.toHaveBeenCalled();
      expect(json).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(serviceError);
    });
  });

  describe('resetPassword', () => {
    it('passes token and password from validated body to service and returns success', async () => {
      const req = createMockRequest<Parameters<AuthController['resetPassword']>[0]>({
        body: {
          token: 'a'.repeat(32),
          password: 'Password123@',
        },
      });

      await authController.resetPassword(req, res, next as unknown as NextFunction);

      expect(mockAuthService.resetPassword).toHaveBeenCalledWith({
        token: 'a'.repeat(32),
        password: 'Password123@',
      });

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith({
        success: true,
        message: 'Password reset successfully',
      });

      expect(next).not.toHaveBeenCalled();
    });

    it('passes reset password service error to next and does not send response', async () => {
      const req = createMockRequest<Parameters<AuthController['resetPassword']>[0]>({
        body: {
          token: 'a'.repeat(32),
          password: 'Password123@',
        },
      });

      const serviceError = new Error('Reset failed');
      mockAuthService.resetPassword.mockRejectedValue(serviceError);

      await authController.resetPassword(req, res, next as unknown as NextFunction);

      expect(status).not.toHaveBeenCalled();
      expect(json).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(serviceError);
    });
  });

  describe('changePassword', () => {
    it('passes authenticated user id and password dto to service and returns success', async () => {
      const changePasswordDto = createChangePasswordDto();

      const req = createMockRequest<Parameters<AuthController['changePassword']>[0]>({
        userId: 'user-1',
        body: changePasswordDto,
      });

      await authController.changePassword(req, res, next as unknown as NextFunction);

      expect(mockAuthService.changePassword).toHaveBeenCalledWith('user-1', changePasswordDto);

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith({
        success: true,
        message: 'Password changed successfully',
      });

      expect(next).not.toHaveBeenCalled();
    });

    it('does not call service when user is unauthenticated', async () => {
      const req = createMockRequest<Parameters<AuthController['changePassword']>[0]>({
        body: createChangePasswordDto(),
      });

      await authController.changePassword(req, res, next as unknown as NextFunction);

      expect(mockAuthService.changePassword).not.toHaveBeenCalled();
      expect(status).not.toHaveBeenCalled();
      expect(json).not.toHaveBeenCalled();

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'Unauthorized',
        }),
      );
    });

    it('passes change password service error to next and does not send response', async () => {
      const req = createMockRequest<Parameters<AuthController['changePassword']>[0]>({
        userId: 'user-1',
        body: createChangePasswordDto(),
      });

      const serviceError = new Error('Change password failed');
      mockAuthService.changePassword.mockRejectedValue(serviceError);

      await authController.changePassword(req, res, next as unknown as NextFunction);

      expect(status).not.toHaveBeenCalled();
      expect(json).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(serviceError);
    });
  });

  describe('getSessions', () => {
    it('returns authenticated user sessions', async () => {
      const sessions = [createSession({ id: 'session-1' })];

      const req = createMockRequest<Request>({
        userId: 'user-1',
      });

      mockAuthService.listUserSessions.mockResolvedValue(sessions);

      await authController.getSessions(req, res, next as unknown as NextFunction);

      expect(mockAuthService.listUserSessions).toHaveBeenCalledWith('user-1');

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith({
        success: true,
        data: sessions,
      });

      expect(next).not.toHaveBeenCalled();
    });

    it('does not list sessions when user is unauthenticated', async () => {
      const req = createMockRequest<Request>();

      await authController.getSessions(req, res, next as unknown as NextFunction);

      expect(mockAuthService.listUserSessions).not.toHaveBeenCalled();
      expect(status).not.toHaveBeenCalled();
      expect(json).not.toHaveBeenCalled();

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'Unauthorized',
        }),
      );
    });
  });

  describe('revokeSession', () => {
    it('revokes requested session and clears cookie when current session is revoked', async () => {
      const req = createMockRequest<Parameters<AuthController['revokeSession']>[0]>({
        userId: 'user-1',
        sessionId: 'session-123',
        params: {
          sessionId: 'session-123',
        },
      });

      await authController.revokeSession(req, res, next as unknown as NextFunction);

      expect(mockAuthService.revokeUserSession).toHaveBeenCalledWith('user-1', 'session-123');

      expect(clearWebSessionCookie).toHaveBeenCalledWith(res);

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith({
        success: true,
        message: 'Session revoked successfully',
      });

      expect(next).not.toHaveBeenCalled();
    });

    it('does not clear cookie when revoking a different session', async () => {
      const req = createMockRequest<Parameters<AuthController['revokeSession']>[0]>({
        userId: 'user-1',
        sessionId: 'current-session',
        params: {
          sessionId: 'other-session',
        },
      });

      await authController.revokeSession(req, res, next as unknown as NextFunction);

      expect(mockAuthService.revokeUserSession).toHaveBeenCalledWith('user-1', 'other-session');

      expect(clearWebSessionCookie).not.toHaveBeenCalled();

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith({
        success: true,
        message: 'Session revoked successfully',
      });
    });

    it('does not revoke session when session id param is invalid', async () => {
      const req = createMockRequest<Parameters<AuthController['revokeSession']>[0]>({
        userId: 'user-1',
        params: {
          sessionId: '',
        },
      });

      await authController.revokeSession(req, res, next as unknown as NextFunction);

      expect(mockAuthService.revokeUserSession).not.toHaveBeenCalled();
      expect(clearWebSessionCookie).not.toHaveBeenCalled();
      expect(status).not.toHaveBeenCalled();
      expect(json).not.toHaveBeenCalled();

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
        }),
      );
    });

    it('does not revoke session when user is unauthenticated', async () => {
      const req = createMockRequest<Parameters<AuthController['revokeSession']>[0]>({
        params: {
          sessionId: 'session-123',
        },
      });

      await authController.revokeSession(req, res, next as unknown as NextFunction);

      expect(mockAuthService.revokeUserSession).not.toHaveBeenCalled();
      expect(clearWebSessionCookie).not.toHaveBeenCalled();
      expect(status).not.toHaveBeenCalled();
      expect(json).not.toHaveBeenCalled();

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'Unauthorized',
        }),
      );
    });
  });

  describe('revokeAllSessions', () => {
    it('revokes all authenticated user sessions, clears cookie, and returns success', async () => {
      const req = createMockRequest<Request>({
        userId: 'user-1',
      });

      await authController.revokeAllSessions(req, res, next as unknown as NextFunction);

      expect(mockAuthService.revokeAllUserSessions).toHaveBeenCalledWith('user-1');
      expect(clearWebSessionCookie).toHaveBeenCalledWith(res);

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith({
        success: true,
        message: 'All sessions revoked successfully',
      });

      expect(next).not.toHaveBeenCalled();
    });

    it('does not revoke sessions or clear cookie when user is unauthenticated', async () => {
      const req = createMockRequest<Request>();

      await authController.revokeAllSessions(req, res, next as unknown as NextFunction);

      expect(mockAuthService.revokeAllUserSessions).not.toHaveBeenCalled();
      expect(clearWebSessionCookie).not.toHaveBeenCalled();
      expect(status).not.toHaveBeenCalled();
      expect(json).not.toHaveBeenCalled();

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'Unauthorized',
        }),
      );
    });
  });
});
