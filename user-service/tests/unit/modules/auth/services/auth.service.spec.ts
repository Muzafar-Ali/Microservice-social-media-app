import { jest } from '@jest/globals';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

jest.mock('../../../../../src/utils/logger.js', () => {
  const mockLogger = {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  return {
    __esModule: true,
    default: mockLogger,
    ...mockLogger,
  };
});

jest.mock('../../../../../src/utils/loginAttemptsTracker.js', () => ({
  isLoginLocked: jest.fn(),
  recordFailedLoginAttempt: jest.fn(),
  resetFailedLoginAttempts: jest.fn(),
}));

jest.mock('../../../../../src/monitoring/metrics.js', () => ({
  authLoginAttemptsTotal: { inc: jest.fn() },
  authSessionsTotal: { inc: jest.fn() },
  passwordChangesTotal: { inc: jest.fn() },
  passwordResetConfirmationsTotal: { inc: jest.fn() },
  passwordResetRequestsTotal: { inc: jest.fn() },
}));

jest.mock('bcrypt', () => {
  const mockBcrypt = {
    compare: jest.fn(),
    hash: jest.fn(),
  };

  return {
    __esModule: true,
    default: mockBcrypt,
    ...mockBcrypt,
  };
});

jest.mock('../../../../../src/config/redisClient.js', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}));

jest.mock('../../../../../src/config/config.js', () => {
  const mockConfig = {
    jwtSecret: 'test-secret',
    saltRounds: 10,
    environment: 'test',
  };

  return {
    __esModule: true,
    default: mockConfig,
    ...mockConfig,
  };
});

jest.mock('../../../../../src/utils/sessionHelpers.js', () => ({
  generateSessionId: jest.fn(() => 'session-123'),
  SESSION_TTL_SECONDS: 3600,
}));

import { AuthService } from '../../../../../src/modules/auth/auth.service.js';
import {
  isLoginLocked,
  recordFailedLoginAttempt,
  resetFailedLoginAttempts,
} from '../../../../../src/utils/loginAttemptsTracker.js';
import {
  authLoginAttemptsTotal,
  authSessionsTotal,
  passwordChangesTotal,
  passwordResetConfirmationsTotal,
  passwordResetRequestsTotal,
} from '../../../../../src/monitoring/metrics.js';
import { redis } from '../../../../../src/config/redisClient.js';
import {
  createChangePasswordDto,
  createForgotPasswordDto,
  createLoginContext,
  createResetPasswordDto,
  createSession,
  createSessionInput,
  createUser,
  createUserLoginDto,
} from '../../../../factories/auth.factory.js';

const hashToken = (token: string) =>
  crypto.createHash('sha256').update(token).digest('hex');

describe('AuthService', () => {
  
  const mockAuthRepository = {
    getUserByEmailOrUsername: jest.fn<() => Promise<unknown | null>>(),
    findUserByEmail: jest.fn<() => Promise<unknown | null>>(),
    findUserById: jest.fn<() => Promise<unknown | null>>(),
    updatePasswordById: jest.fn<() => Promise<unknown>>(),
    createUserSession: jest.fn<() => Promise<unknown>>(),
    listActiveSessionsByUserId: jest.fn<() => Promise<unknown[]>>(),
    revokeSessionById: jest.fn<() => Promise<{ count: number }>>(),
    revokeAllSessionsByUserId: jest.fn<() => Promise<{ count: number }>>(),
    touchSession: jest.fn<() => Promise<{ count: number }>>(),
  };

  let authService: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();

    authService = new AuthService(mockAuthRepository as never);
    
    mockAuthRepository.getUserByEmailOrUsername.mockResolvedValue(undefined);
    mockAuthRepository.findUserByEmail.mockResolvedValue(undefined);
    mockAuthRepository.findUserById.mockResolvedValue(undefined);
    mockAuthRepository.updatePasswordById.mockResolvedValue(undefined);
    mockAuthRepository.createUserSession.mockResolvedValue(undefined);
    mockAuthRepository.listActiveSessionsByUserId.mockResolvedValue([]);
    mockAuthRepository.revokeSessionById.mockResolvedValue({ count: 0 });
    mockAuthRepository.revokeAllSessionsByUserId.mockResolvedValue({ count: 0 });
    mockAuthRepository.touchSession.mockResolvedValue({ count: 0 });

    jest.mocked(redis.get).mockResolvedValue(null as never);
    jest.mocked(redis.set).mockResolvedValue('OK' as never);
    jest.mocked(redis.del).mockResolvedValue(1 as never);
    jest.mocked(bcrypt.hash).mockResolvedValue('new-hashed-password' as never);
  });

  describe('userLogin', () => {
    it('throws 429 and does not query user when login is locked', async () => {
      // Arrange
      jest.mocked(isLoginLocked).mockResolvedValue(true);

      // Act
      const loginPromise = authService.userLogin(
        createUserLoginDto(),
        createLoginContext(),
      );

      // Assert
      await expect(loginPromise).rejects.toMatchObject({
        statusCode: 429,
        message: 'Too many failed attempts. Please try again later.',
      });

      expect(authLoginAttemptsTotal.inc).toHaveBeenCalledWith({
        result: 'blocked',
        reason: 'lockout_active',
      });
      expect(mockAuthRepository.getUserByEmailOrUsername).not.toHaveBeenCalled();
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('throws 401, records failed attempt, and does not compare password when user does not exist', async () => {
      // Arrange
      const context = createLoginContext();

      jest.mocked(isLoginLocked).mockResolvedValue(false);
      mockAuthRepository.getUserByEmailOrUsername.mockResolvedValue(null);

      // Act
      const loginPromise = authService.userLogin(createUserLoginDto(), context);

      // Assert
      await expect(loginPromise).rejects.toMatchObject({
        statusCode: 401,
        message: 'Invalid credentials',
      });

      expect(mockAuthRepository.getUserByEmailOrUsername).toHaveBeenCalledWith(
        'user@example.com',
        undefined,
      );
      expect(recordFailedLoginAttempt).toHaveBeenCalledWith(context);
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(authLoginAttemptsTotal.inc).toHaveBeenCalledWith({
        result: 'failed',
        reason: 'user_not_found',
      });
    });

    it.each(['BLOCKED', 'SUSPENDED', 'DELETED'])(
      'throws 403 and does not compare password when account status is %s',
      async (status) => {
        // Arrange
        jest.mocked(isLoginLocked).mockResolvedValue(false);
        mockAuthRepository.getUserByEmailOrUsername.mockResolvedValue(
          createUser({ status }),
        );

        // Act
        const loginPromise = authService.userLogin(
          createUserLoginDto(),
          createLoginContext(),
        );

        // Assert
        await expect(loginPromise).rejects.toMatchObject({
          statusCode: 403,
          message: 'Account is not allowed to login',
        });

        expect(bcrypt.compare).not.toHaveBeenCalled();
        expect(recordFailedLoginAttempt).not.toHaveBeenCalled();
        expect(authLoginAttemptsTotal.inc).toHaveBeenCalledWith({
          result: 'blocked',
          reason: `account_${status.toLowerCase()}`,
        });
      },
    );

    it('throws 401 and records failed attempt when password is incorrect', async () => {
      // Arrange
      const context = createLoginContext();

      jest.mocked(isLoginLocked).mockResolvedValue(false);
      mockAuthRepository.getUserByEmailOrUsername.mockResolvedValue(createUser());
      jest.mocked(bcrypt.compare).mockResolvedValue(false as never);

      // Act
      const loginPromise = authService.userLogin(createUserLoginDto(), context);

      // Assert
      await expect(loginPromise).rejects.toMatchObject({
        statusCode: 401,
        message: 'Invalid credentials',
      });

      expect(bcrypt.compare).toHaveBeenCalledWith(
        'password123',
        'hashed-password',
      );
      expect(recordFailedLoginAttempt).toHaveBeenCalledWith(context);
      expect(resetFailedLoginAttempts).not.toHaveBeenCalled();
      expect(authLoginAttemptsTotal.inc).toHaveBeenCalledWith({
        result: 'failed',
        reason: 'invalid_password',
      });
    });

    it('returns user and resets failed attempts when credentials are valid', async () => {
      // Arrange
      const activeUser = createUser();

      jest.mocked(isLoginLocked).mockResolvedValue(false);
      mockAuthRepository.getUserByEmailOrUsername.mockResolvedValue(activeUser);
      jest.mocked(bcrypt.compare).mockResolvedValue(true as never);

      // Act
      const result = await authService.userLogin(
        createUserLoginDto({ password: 'correct-password' }),
        createLoginContext(),
      );

      // Assert
      expect(result).toBe(activeUser);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'correct-password',
        'hashed-password',
      );
      expect(recordFailedLoginAttempt).not.toHaveBeenCalled();
      expect(resetFailedLoginAttempts).toHaveBeenCalledWith('user@example.com');
      expect(authLoginAttemptsTotal.inc).toHaveBeenCalledWith({
        result: 'success',
        reason: 'valid_credentials',
      });
    });

    it('throws repository error when user lookup fails', async () => {
      // Arrange
      jest.mocked(isLoginLocked).mockResolvedValue(false);
      mockAuthRepository.getUserByEmailOrUsername.mockRejectedValue(
        new Error('Database unavailable'),
      );

      // Act
      const loginPromise = authService.userLogin(
        createUserLoginDto(),
        createLoginContext(),
      );

      // Assert
      await expect(loginPromise).rejects.toThrow('Database unavailable');
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(recordFailedLoginAttempt).not.toHaveBeenCalled();
      expect(authLoginAttemptsTotal.inc).not.toHaveBeenCalledWith({
        result: 'success',
        reason: 'valid_credentials',
      });
    });
  });

  describe('createSession', () => {
    it('creates a session in Redis and repository, then returns session id', async () => {
      // Arrange
      mockAuthRepository.createUserSession.mockResolvedValue(undefined);

      // Act
      const result = await authService.createSession(createSessionInput());

      // Assert
      expect(result).toBe('session-123');

      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('session-123'),
        expect.stringContaining('"userId":"user-1"'),
        {
          expiration: {
            type: 'EX',
            value: 3600,
          },
        },
      );

      expect(mockAuthRepository.createUserSession).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'session-123',
          userId: 'user-1',
          refreshTokenHash: hashToken('session-123'),
          deviceName: 'Chrome on Windows',
          userAgent: 'jest-agent',
          expiresAt: expect.any(Date),
        }),
      );

      expect(authSessionsTotal.inc).toHaveBeenCalledWith({
        operation: 'create',
        result: 'success',
      });
    });

    it('throws error and does not create repository session when Redis set fails', async () => {
      // Arrange
      jest
        .mocked(redis.set)
        .mockRejectedValue(new Error('Redis unavailable') as never);

      // Act
      const createSessionPromise = authService.createSession(createSessionInput());

      // Assert
      await expect(createSessionPromise).rejects.toThrow('Redis unavailable');
      expect(mockAuthRepository.createUserSession).not.toHaveBeenCalled();
      expect(authSessionsTotal.inc).not.toHaveBeenCalledWith({
        operation: 'create',
        result: 'success',
      });
    });

    it('throws error when repository session creation fails', async () => {
      // Arrange
      mockAuthRepository.createUserSession.mockRejectedValue(
        new Error('Database unavailable'),
      );

      // Act
      const createSessionPromise = authService.createSession(createSessionInput());

      // Assert
      await expect(createSessionPromise).rejects.toThrow('Database unavailable');
      expect(redis.set).toHaveBeenCalledTimes(1);
      expect(mockAuthRepository.createUserSession).toHaveBeenCalledTimes(1);
      expect(authSessionsTotal.inc).not.toHaveBeenCalledWith({
        operation: 'create',
        result: 'success',
      });
    });
  });

  describe('requestPasswordReset', () => {
    it('does not reveal account existence when user does not exist', async () => {
      // Arrange
      mockAuthRepository.findUserByEmail.mockResolvedValue(null);

      // Act
      await authService.requestPasswordReset(createForgotPasswordDto());

      // Assert
      expect(mockAuthRepository.findUserByEmail).toHaveBeenCalledWith(
        'user@example.com',
      );
      expect(redis.set).not.toHaveBeenCalled();
      expect(passwordResetRequestsTotal.inc).toHaveBeenCalledWith({
        result: 'user_not_found',
      });
    });

    it('does not create reset token when account is deleted', async () => {
      // Arrange
      mockAuthRepository.findUserByEmail.mockResolvedValue(
        createUser({ status: 'DELETED' }),
      );

      // Act
      await authService.requestPasswordReset(createForgotPasswordDto());

      // Assert
      expect(redis.set).not.toHaveBeenCalled();
      expect(passwordResetRequestsTotal.inc).toHaveBeenCalledWith({
        result: 'account_deleted',
      });
    });

    it('creates password reset token for active user', async () => {
      // Arrange
      mockAuthRepository.findUserByEmail.mockResolvedValue(createUser());
      jest.mocked(redis.get).mockResolvedValue(null as never);

      // Act
      await authService.requestPasswordReset(createForgotPasswordDto());

      // Assert
      expect(redis.set).toHaveBeenCalledTimes(2);
      expect(redis.set).toHaveBeenCalledWith(
        expect.any(String),
        'user-1',
        {
          expiration: {
            type: 'EX',
            value: 900,
          },
        },
      );
      expect(redis.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        {
          expiration: {
            type: 'EX',
            value: 900,
          },
        },
      );
      expect(passwordResetRequestsTotal.inc).toHaveBeenCalledWith({
        result: 'requested',
      });
    });

    it('deletes existing reset token before creating a new one', async () => {
      // Arrange
      mockAuthRepository.findUserByEmail.mockResolvedValue(createUser());
      jest.mocked(redis.get).mockResolvedValue('old-token-hash' as never);

      // Act
      await authService.requestPasswordReset(createForgotPasswordDto());

      // Assert
      expect(redis.del).toHaveBeenCalledWith(expect.stringContaining('old-token-hash'));
      expect(redis.set).toHaveBeenCalledTimes(2);
      expect(passwordResetRequestsTotal.inc).toHaveBeenCalledWith({
        result: 'requested',
      });
    });

    it('throws when repository lookup fails', async () => {
      // Arrange
      mockAuthRepository.findUserByEmail.mockRejectedValue(
        new Error('Database unavailable'),
      );

      // Act
      const resetRequestPromise = authService.requestPasswordReset(
        createForgotPasswordDto(),
      );

      // Assert
      await expect(resetRequestPromise).rejects.toThrow('Database unavailable');
      expect(redis.set).not.toHaveBeenCalled();
      expect(passwordResetRequestsTotal.inc).not.toHaveBeenCalledWith({
        result: 'requested',
      });
    });
  });

  describe('resetPassword', () => {
    it('throws 400 when reset token is invalid or expired', async () => {
      // Arrange
      jest.mocked(redis.get).mockResolvedValue(null as never);

      // Act
      const resetPasswordPromise = authService.resetPassword(
        createResetPasswordDto(),
      );

      // Assert
      await expect(resetPasswordPromise).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid or expired password reset token',
      });
      expect(mockAuthRepository.findUserById).not.toHaveBeenCalled();
      expect(passwordResetConfirmationsTotal.inc).toHaveBeenCalledWith({
        result: 'invalid_or_expired_token',
      });
    });

    it('throws 400 and deletes token when user does not exist', async () => {
      // Arrange
      jest.mocked(redis.get).mockResolvedValueOnce('user-1' as never);
      mockAuthRepository.findUserById.mockResolvedValue(null);

      // Act
      const resetPasswordPromise = authService.resetPassword(
        createResetPasswordDto(),
      );

      // Assert
      await expect(resetPasswordPromise).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid or expired password reset token',
      });
      expect(redis.del).toHaveBeenCalledWith(expect.any(String));
      expect(passwordResetConfirmationsTotal.inc).toHaveBeenCalledWith({
        result: 'account_unavailable',
      });
    });

    it('throws 400 and deletes token when account is deleted', async () => {
      // Arrange
      jest.mocked(redis.get).mockResolvedValueOnce('user-1' as never);
      mockAuthRepository.findUserById.mockResolvedValue(
        createUser({ status: 'DELETED' }),
      );

      // Act
      const resetPasswordPromise = authService.resetPassword(
        createResetPasswordDto(),
      );

      // Assert
      await expect(resetPasswordPromise).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid or expired password reset token',
      });
      expect(redis.del).toHaveBeenCalledWith(expect.any(String));
      expect(passwordResetConfirmationsTotal.inc).toHaveBeenCalledWith({
        result: 'account_unavailable',
      });
    });

    it('throws 400 when new password is same as current password', async () => {
      // Arrange
      jest.mocked(redis.get).mockResolvedValueOnce('user-1' as never);
      mockAuthRepository.findUserById.mockResolvedValue(createUser());
      jest.mocked(bcrypt.compare).mockResolvedValue(true as never);

      // Act
      const resetPasswordPromise = authService.resetPassword(
        createResetPasswordDto(),
      );

      // Assert
      await expect(resetPasswordPromise).rejects.toMatchObject({
        statusCode: 400,
        message: 'new password must be different from current password',
      });
      expect(mockAuthRepository.updatePasswordById).not.toHaveBeenCalled();
      expect(passwordResetConfirmationsTotal.inc).toHaveBeenCalledWith({
        result: 'same_password',
      });
    });

    it('updates password, deletes reset token, revokes sessions, and records success', async () => {
      // Arrange
      jest
        .mocked(redis.get)
        .mockResolvedValueOnce('user-1' as never)
        .mockResolvedValueOnce('stored-token-hash' as never);

      mockAuthRepository.findUserById.mockResolvedValue(createUser());
      mockAuthRepository.listActiveSessionsByUserId.mockResolvedValue([
        createSession({ id: 'session-1' }),
        createSession({ id: 'session-2' }),
      ]);
      mockAuthRepository.revokeAllSessionsByUserId.mockResolvedValue({ count: 2 });
      jest.mocked(bcrypt.compare).mockResolvedValue(false as never);

      // Act
      await authService.resetPassword(createResetPasswordDto());

      // Assert
      expect(bcrypt.hash).toHaveBeenCalledWith('NewPassword123!', 10);
      expect(mockAuthRepository.updatePasswordById).toHaveBeenCalledWith(
        'user-1',
        'new-hashed-password',
      );
      expect(mockAuthRepository.revokeAllSessionsByUserId).toHaveBeenCalledWith(
        'user-1',
      );
      expect(redis.del).toHaveBeenCalledWith(expect.any(Array));
      expect(passwordResetConfirmationsTotal.inc).toHaveBeenCalledWith({
        result: 'success',
      });
    });

    it('throws when password update fails', async () => {
      // Arrange
      jest.mocked(redis.get).mockResolvedValueOnce('user-1' as never);
      mockAuthRepository.findUserById.mockResolvedValue(createUser());
      jest.mocked(bcrypt.compare).mockResolvedValue(false as never);
      mockAuthRepository.updatePasswordById.mockRejectedValue(
        new Error('Database unavailable'),
      );

      // Act
      const resetPasswordPromise = authService.resetPassword(
        createResetPasswordDto(),
      );

      // Assert
      await expect(resetPasswordPromise).rejects.toThrow('Database unavailable');
      expect(mockAuthRepository.revokeAllSessionsByUserId).not.toHaveBeenCalled();
      expect(passwordResetConfirmationsTotal.inc).not.toHaveBeenCalledWith({
        result: 'success',
      });
    });
  });

  describe('changePassword', () => {
    it('throws 404 when authenticated user does not exist', async () => {
      // Arrange
      mockAuthRepository.findUserById.mockResolvedValue(null);

      // Act
      const changePasswordPromise = authService.changePassword(
        'user-1',
        createChangePasswordDto(),
      );

      // Assert
      await expect(changePasswordPromise).rejects.toMatchObject({
        statusCode: 404,
        message: 'user not found',
      });
      expect(passwordChangesTotal.inc).toHaveBeenCalledWith({
        result: 'user_not_found',
      });
    });

    it('throws 410 when account is deleted', async () => {
      // Arrange
      mockAuthRepository.findUserById.mockResolvedValue(
        createUser({ status: 'DELETED' }),
      );

      // Act
      const changePasswordPromise = authService.changePassword(
        'user-1',
        createChangePasswordDto(),
      );

      // Assert
      await expect(changePasswordPromise).rejects.toMatchObject({
        statusCode: 410,
        message: 'account already deleted',
      });
      expect(passwordChangesTotal.inc).toHaveBeenCalledWith({
        result: 'account_deleted',
      });
    });

    it('throws 401 when current password is incorrect', async () => {
      // Arrange
      mockAuthRepository.findUserById.mockResolvedValue(createUser());
      jest.mocked(bcrypt.compare).mockResolvedValue(false as never);

      // Act
      const changePasswordPromise = authService.changePassword(
        'user-1',
        createChangePasswordDto(),
      );

      // Assert
      await expect(changePasswordPromise).rejects.toMatchObject({
        statusCode: 401,
        message: 'current password is incorrect',
      });
      expect(mockAuthRepository.updatePasswordById).not.toHaveBeenCalled();
      expect(passwordChangesTotal.inc).toHaveBeenCalledWith({
        result: 'invalid_current_password',
      });
    });

    it('updates password, deletes reset token, revokes sessions, and records success', async () => {
      // Arrange
      mockAuthRepository.findUserById.mockResolvedValue(createUser());
      jest.mocked(bcrypt.compare).mockResolvedValue(true as never);
      jest.mocked(redis.get).mockResolvedValue('stored-token-hash' as never);
      mockAuthRepository.listActiveSessionsByUserId.mockResolvedValue([
        createSession({ id: 'session-1' }),
      ]);
      mockAuthRepository.revokeAllSessionsByUserId.mockResolvedValue({ count: 1 });

      // Act
      await authService.changePassword('user-1', createChangePasswordDto());

      // Assert
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'CurrentPassword123!',
        'hashed-password',
      );
      expect(bcrypt.hash).toHaveBeenCalledWith('NewPassword123!', 10);
      expect(mockAuthRepository.updatePasswordById).toHaveBeenCalledWith(
        'user-1',
        'new-hashed-password',
      );
      expect(mockAuthRepository.revokeAllSessionsByUserId).toHaveBeenCalledWith(
        'user-1',
      );
      expect(passwordChangesTotal.inc).toHaveBeenCalledWith({
        result: 'success',
      });
    });

    it('throws when repository password update fails', async () => {
      // Arrange
      mockAuthRepository.findUserById.mockResolvedValue(createUser());
      jest.mocked(bcrypt.compare).mockResolvedValue(true as never);
      mockAuthRepository.updatePasswordById.mockRejectedValue(
        new Error('Database unavailable'),
      );

      // Act
      const changePasswordPromise = authService.changePassword(
        'user-1',
        createChangePasswordDto(),
      );

      // Assert
      await expect(changePasswordPromise).rejects.toThrow('Database unavailable');
      expect(mockAuthRepository.revokeAllSessionsByUserId).not.toHaveBeenCalled();
      expect(passwordChangesTotal.inc).not.toHaveBeenCalledWith({
        result: 'success',
      });
    });
  });

  describe('listUserSessions', () => {
    it('returns active user sessions and records success metric', async () => {
      // Arrange
      const sessions = [createSession({ id: 'session-1' })];
      mockAuthRepository.listActiveSessionsByUserId.mockResolvedValue(sessions);

      // Act
      const result = await authService.listUserSessions('user-1');

      // Assert
      expect(result).toBe(sessions);
      expect(mockAuthRepository.listActiveSessionsByUserId).toHaveBeenCalledWith(
        'user-1',
      );
      expect(authSessionsTotal.inc).toHaveBeenCalledWith({
        operation: 'list',
        result: 'success',
      });
    });

    it('throws when repository list sessions fails', async () => {
      // Arrange
      mockAuthRepository.listActiveSessionsByUserId.mockRejectedValue(
        new Error('Database unavailable'),
      );

      // Act
      const listSessionsPromise = authService.listUserSessions('user-1');

      // Assert
      await expect(listSessionsPromise).rejects.toThrow('Database unavailable');
      expect(authSessionsTotal.inc).not.toHaveBeenCalledWith({
        operation: 'list',
        result: 'success',
      });
    });
  });

  describe('revokeUserSession', () => {
    it('revokes existing session from repository and Redis', async () => {
      // Arrange
      mockAuthRepository.revokeSessionById.mockResolvedValue({ count: 1 });

      // Act
      await authService.revokeUserSession('user-1', 'session-123');

      // Assert
      expect(mockAuthRepository.revokeSessionById).toHaveBeenCalledWith(
        'session-123',
        'user-1',
      );
      expect(redis.del).toHaveBeenCalledWith(expect.stringContaining('session-123'));
      expect(authSessionsTotal.inc).toHaveBeenCalledWith({
        operation: 'revoke_one',
        result: 'success',
      });
    });

    it('throws 404 when session is missing and failIfMissing is true', async () => {
      // Arrange
      mockAuthRepository.revokeSessionById.mockResolvedValue({ count: 0 });

      // Act
      const revokePromise = authService.revokeUserSession('user-1', 'missing-id');

      // Assert
      await expect(revokePromise).rejects.toMatchObject({
        statusCode: 404,
        message: 'session not found',
      });
      expect(redis.del).not.toHaveBeenCalled();
      expect(authSessionsTotal.inc).toHaveBeenCalledWith({
        operation: 'revoke_one',
        result: 'not_found',
      });
    });

    it('does not throw when session is missing and failIfMissing is false', async () => {
      // Arrange
      mockAuthRepository.revokeSessionById.mockResolvedValue({ count: 0 });

      // Act
      await authService.revokeUserSession('user-1', 'missing-id', {
        failIfMissing: false,
      });

      // Assert
      expect(redis.del).toHaveBeenCalledWith(expect.stringContaining('missing-id'));
      expect(authSessionsTotal.inc).toHaveBeenCalledWith({
        operation: 'revoke_one',
        result: 'not_found',
      });
      expect(authSessionsTotal.inc).not.toHaveBeenCalledWith({
        operation: 'revoke_one',
        result: 'success',
      });
    });

    it('throws when repository revoke fails', async () => {
      // Arrange
      mockAuthRepository.revokeSessionById.mockRejectedValue(
        new Error('Database unavailable'),
      );

      // Act
      const revokePromise = authService.revokeUserSession(
        'user-1',
        'session-123',
      );

      // Assert
      await expect(revokePromise).rejects.toThrow('Database unavailable');
      expect(redis.del).not.toHaveBeenCalled();
    });
  });

  describe('revokeAllUserSessions', () => {
    it('revokes all sessions and deletes Redis sessions when active sessions exist', async () => {
      // Arrange
      mockAuthRepository.listActiveSessionsByUserId.mockResolvedValue([
        createSession({ id: 'session-1' }),
        createSession({ id: 'session-2' }),
      ]);
      mockAuthRepository.revokeAllSessionsByUserId.mockResolvedValue({ count: 2 });

      // Act
      await authService.revokeAllUserSessions('user-1');

      // Assert
      expect(mockAuthRepository.listActiveSessionsByUserId).toHaveBeenCalledWith(
        'user-1',
      );
      expect(mockAuthRepository.revokeAllSessionsByUserId).toHaveBeenCalledWith(
        'user-1',
      );
      expect(redis.del).toHaveBeenCalledWith(expect.any(Array));
      expect(authSessionsTotal.inc).toHaveBeenCalledWith({
        operation: 'revoke_all',
        result: 'success',
      });
    });

    it('revokes all sessions without deleting Redis keys when no active sessions exist', async () => {
      // Arrange
      mockAuthRepository.listActiveSessionsByUserId.mockResolvedValue([]);
      mockAuthRepository.revokeAllSessionsByUserId.mockResolvedValue({ count: 0 });

      // Act
      await authService.revokeAllUserSessions('user-1');

      // Assert
      expect(mockAuthRepository.revokeAllSessionsByUserId).toHaveBeenCalledWith(
        'user-1',
      );
      expect(redis.del).not.toHaveBeenCalled();
      expect(authSessionsTotal.inc).toHaveBeenCalledWith({
        operation: 'revoke_all',
        result: 'success',
      });
    });

    it('throws when repository fails while listing sessions', async () => {
      // Arrange
      mockAuthRepository.listActiveSessionsByUserId.mockRejectedValue(
        new Error('Database unavailable'),
      );

      // Act
      const revokeAllPromise = authService.revokeAllUserSessions('user-1');

      // Assert
      await expect(revokeAllPromise).rejects.toThrow('Database unavailable');
      expect(mockAuthRepository.revokeAllSessionsByUserId).not.toHaveBeenCalled();
      expect(authSessionsTotal.inc).not.toHaveBeenCalledWith({
        operation: 'revoke_all',
        result: 'success',
      });
    });
  });

  describe('touchSession', () => {
    it('touches session through repository', async () => {
      // Arrange
      mockAuthRepository.touchSession.mockResolvedValue({ count: 1 });

      // Act
      await authService.touchSession('session-123');

      // Assert
      expect(mockAuthRepository.touchSession).toHaveBeenCalledWith('session-123');
    });

    it('throws when repository touch session fails', async () => {
      // Arrange
      mockAuthRepository.touchSession.mockRejectedValue(
        new Error('Database unavailable'),
      );

      // Act
      const touchPromise = authService.touchSession('session-123');

      // Assert
      await expect(touchPromise).rejects.toThrow('Database unavailable');
    });
  });
});