import { jest } from '@jest/globals';
import bcrypt from 'bcrypt'

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

jest.mock('../../../../../src/config/config.js', () => ({
  default: {
    jwtSecret: 'test-secret',
    saltRounds: 10,
    environment: 'test',
  },
}));

import { AuthService } from '../../../../../src/modules/auth/auth.service.js';
import { isLoginLocked, recordFailedLoginAttempt, resetFailedLoginAttempts } from '../../../../../src/utils/loginAttemptsTracker.js';
import { authLoginAttemptsTotal } from '../../../../../src/monitoring/metrics.js';

describe('AuthService.userLogin', () => {
  
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

  const authService = new AuthService(mockAuthRepository as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws 429 and does not query user when login is locked', async () => {
    jest.mocked(isLoginLocked).mockResolvedValue(true);

    const loginPromise = authService.userLogin(
      {
        email: 'user@example.com',
        password: 'password123',
      }, 
      {
        identifier: 'user@example.com',
        ip: '127.0.0.1',
        userAgent: 'jest',
      }
    );

    await expect(loginPromise).rejects.toMatchObject({
      statusCode: 429,
      message: 'Too many failed attempts. Please try again later.',
    });

    expect(authLoginAttemptsTotal.inc).toHaveBeenCalledWith({
      result: 'blocked',
      reason: 'lockout_active',
    });

    expect(mockAuthRepository.getUserByEmailOrUsername).not.toHaveBeenCalled();

  });

  it('throws 401 when user does not exist', async () => {
    jest.mocked(isLoginLocked).mockResolvedValue(false);

    mockAuthRepository.getUserByEmailOrUsername.mockResolvedValue(null);

    const loginPromise = authService.userLogin(
      {
        email: 'user@example.com',
        password: 'password123',
      }, 
      {
        identifier: 'user@example.com',
        ip: '127.0.0.1',
        userAgent: 'jest',
      }
    );

    await expect(loginPromise).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid credentials',
    });

    expect(mockAuthRepository.getUserByEmailOrUsername).toHaveBeenCalledWith('user@example.com', undefined);

    expect(recordFailedLoginAttempt).toHaveBeenCalledTimes(1);

    expect(authLoginAttemptsTotal.inc).toHaveBeenCalledWith({
      result: 'failed',
      reason: 'user_not_found',
    });
  })

  it.each([
    'BLOCKED',
    'SUSPENDED',
    'DELETED',
  ])('throws 403 when account status is %s', async(status) => {
      jest.mocked(isLoginLocked).mockResolvedValue(false);
    
      mockAuthRepository.getUserByEmailOrUsername.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        username: 'testuser',
        password: 'hashed-password',
        status,
      });
      
      const loginPromise = authService.userLogin(
        {
          email: 'user@example.com',
          password: 'password123',
        }, 
        {
          identifier: 'user@example.com',
          ip: '127.0.0.1',
          userAgent: 'jest',
        }
      );

      await expect(loginPromise).rejects.toMatchObject({
        statusCode: 403,
        message: 'Account is not allowed to login',
      });

      expect(authLoginAttemptsTotal.inc).toHaveBeenCalledWith({
        result: 'blocked',
        reason: `account_${status.toLowerCase()}`,
      });
    }
  );

  it('throws 401 and records failed attempt when password is incorrect', async () => {
    jest.mocked(isLoginLocked).mockResolvedValue(false);

    mockAuthRepository.getUserByEmailOrUsername.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      username: 'testuser',
      password: 'hashed-password',
      status: 'ACTIVE',
    });

    jest.mocked(bcrypt.compare).mockResolvedValue(false as never);

    const loginPromise = authService.userLogin(
      {
        email: 'user@example.com',
        password: 'password123',
      }, 
      {
        identifier: 'user@example.com',
        ip: '127.0.0.1',
        userAgent: 'jest',
      }
    );

    await expect(loginPromise).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid credentials',
    });
    
    expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed-password');

    expect(recordFailedLoginAttempt).toHaveBeenCalledWith({
      identifier: 'user@example.com',
      ip: '127.0.0.1',
      userAgent: 'jest',
    });

    expect(authLoginAttemptsTotal.inc).toHaveBeenCalledWith({
      result: 'failed',
      reason: 'invalid_password',
    });
  });

  it('returns user and resets failed attempts when credentials are valid', async () => {
    jest.mocked(isLoginLocked).mockResolvedValue(false);

    const activeUser = {
      id: 'user-1',
      email: 'user@example.com',
      username: 'testuser',
      password: 'hashed-password',
      status: 'ACTIVE',
    };

    mockAuthRepository.getUserByEmailOrUsername.mockResolvedValue(activeUser);

    jest.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const result = await authService.userLogin(
      {
        email: 'user@example.com',
        password: 'correct-password',
      },
      {
        identifier: 'user@example.com',
        ip: '127.0.0.1',
        userAgent: 'jest',
      },
    );

    expect(result).toBe(activeUser);

    expect(bcrypt.compare).toHaveBeenCalledWith(
      'correct-password',
      'hashed-password',
    );

    expect(resetFailedLoginAttempts).toHaveBeenCalledWith('user@example.com');

    expect(authLoginAttemptsTotal.inc).toHaveBeenCalledWith({
      result: 'success',
      reason: 'valid_credentials',
    });
  });
});