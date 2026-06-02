import ApiErrorHandler from '../../utils/apiErrorHandlerClass.js';
import logger from '../../utils/logger.js';
import { AuthRepository } from './auth.repository.js';
import { ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto, UserLoginDto } from './auth.validations.js';
import bcrypt from 'bcrypt';
import { TLoginContext } from './auth.types.js';
import { isLoginLocked, recordFailedLoginAttempt, resetFailedLoginAttempts } from '../../utils/loginAttemptsTracker.js';
import {
  authLoginAttemptsTotal,
  authSessionsTotal,
  passwordChangesTotal,
  passwordResetConfirmationsTotal,
  passwordResetRequestsTotal,
} from '../../monitoring/metrics.js';
import crypto from 'crypto';
import config from '../../config/config.js';
import { redis } from '../../config/redisClient.js';
import {
  passwordResetTokenCacheKey,
  passwordResetUserCacheKey,
  sessionCacheKey,
} from '../../cache/cache.keys.js';
import { generateSessionId, SESSION_TTL_SECONDS } from '../../utils/sessionHelpers.js';

const PASSWORD_RESET_TOKEN_TTL_SECONDS = 15 * 60;

const hashToken = (token: string) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export class AuthService {
  constructor(private authRepository: AuthRepository) {}

  userLogin = async (dto: UserLoginDto, context: TLoginContext) => {
    // Check if user is locked due to repeated failed attempts
    if (await isLoginLocked(context.identifier)) {
      authLoginAttemptsTotal.inc({ result: 'blocked', reason: 'lockout_active' });

      logger.warn(
        {
          identifier: context.identifier,
          ip: context.ip,
        },
        'Login attempt while account is locked',
      );

      throw new ApiErrorHandler(429, 'Too many failed attempts. Please try again later.');
    }

    // Find user by email or username
    const user = await this.authRepository.getUserByEmailOrUsername(dto.email, dto.username);

    if (!user) {
      authLoginAttemptsTotal.inc({ result: 'failed', reason: 'user_not_found' });
      await recordFailedLoginAttempt(context);
      throw new ApiErrorHandler(401, 'Invalid credentials');
    }

    if (user.status === 'BLOCKED' || user.status === 'SUSPENDED' || user.status === 'DELETED') {
      authLoginAttemptsTotal.inc({ result: 'blocked', reason: `account_${user.status.toLowerCase()}` });
      throw new ApiErrorHandler(403, 'Account is not allowed to login');
    }

    //  Verify password
    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      authLoginAttemptsTotal.inc({ result: 'failed', reason: 'invalid_password' });
      await recordFailedLoginAttempt(context);
      throw new ApiErrorHandler(401, 'Invalid credentials');
    }

    // Successful login → reset counters
    authLoginAttemptsTotal.inc({ result: 'success', reason: 'valid_credentials' });

    await resetFailedLoginAttempts(context.identifier);

    return user;
  };

  createSession = async (input: { userId: string; ip?: string; userAgent?: string; deviceName?: string }) => {
    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

    await redis.set(
      sessionCacheKey(sessionId),
      JSON.stringify({
        userId: input.userId,
        createdAt: Date.now(),
        expiry: SESSION_TTL_SECONDS,
        ip: input.ip,
        userAgent: input.userAgent,
      }),
      {
        expiration: {
          type: 'EX',
          value: SESSION_TTL_SECONDS,
        },
      },
    );

    await this.authRepository.createUserSession({
      id: sessionId,
      userId: input.userId,
      refreshTokenHash: hashToken(sessionId),
      deviceName: input.deviceName,
      userAgent: input.userAgent,
      expiresAt,
    });

    authSessionsTotal.inc({ operation: 'create', result: 'success' });

    return sessionId;
  };

  requestPasswordReset = async (dto: ForgotPasswordDto) => {
    const user = await this.authRepository.findUserByEmail(dto.email);

    if (!user) {
      passwordResetRequestsTotal.inc({ result: 'user_not_found' });
      return;
    }

    if (user.status === 'DELETED') {
      passwordResetRequestsTotal.inc({ result: 'account_deleted' });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);

    await this.deletePasswordResetTokenForUser(user.id);

    await redis.set(passwordResetTokenCacheKey(tokenHash), user.id, {
      expiration: {
        type: 'EX',
        value: PASSWORD_RESET_TOKEN_TTL_SECONDS,
      },
    });

    await redis.set(passwordResetUserCacheKey(user.id), tokenHash, {
      expiration: {
        type: 'EX',
        value: PASSWORD_RESET_TOKEN_TTL_SECONDS,
      },
    });

    passwordResetRequestsTotal.inc({ result: 'requested' });

    logger.info(
      {
        userId: user.id,
        email: user.email,
        resetToken: token,
        expiresInSeconds: PASSWORD_RESET_TOKEN_TTL_SECONDS,
      },
      'Password reset token generated',
    );
  };

  resetPassword = async (dto: ResetPasswordDto) => {
    const tokenHash = hashToken(dto.token);
    const userId = await redis.get(passwordResetTokenCacheKey(tokenHash));

    if (!userId) {
      passwordResetConfirmationsTotal.inc({ result: 'invalid_or_expired_token' });
      throw new ApiErrorHandler(400, 'Invalid or expired password reset token');
    }

    const user = await this.authRepository.findUserById(userId);

    if (!user || user.status === 'DELETED') {
      await redis.del(passwordResetTokenCacheKey(tokenHash));
      passwordResetConfirmationsTotal.inc({ result: 'account_unavailable' });
      throw new ApiErrorHandler(400, 'Invalid or expired password reset token');
    }

    const isSamePassword = await bcrypt.compare(dto.password, user.password);

    if (isSamePassword) {
      passwordResetConfirmationsTotal.inc({ result: 'same_password' });
      throw new ApiErrorHandler(400, 'new password must be different from current password');
    }

    await this.updateUserPassword(user.id, dto.password);
    await this.deletePasswordResetTokenForUser(user.id);
    await this.revokeAllUserSessions(user.id);

    passwordResetConfirmationsTotal.inc({ result: 'success' });
  };

  changePassword = async (authenticatedUserId: string, dto: ChangePasswordDto) => {
    const user = await this.authRepository.findUserById(authenticatedUserId);

    if (!user) {
      passwordChangesTotal.inc({ result: 'user_not_found' });
      throw new ApiErrorHandler(404, 'user not found');
    }

    if (user.status === 'DELETED') {
      passwordChangesTotal.inc({ result: 'account_deleted' });
      throw new ApiErrorHandler(410, 'account already deleted');
    }

    const isCurrentPasswordValid = await bcrypt.compare(dto.currentPassword, user.password);

    if (!isCurrentPasswordValid) {
      passwordChangesTotal.inc({ result: 'invalid_current_password' });
      throw new ApiErrorHandler(401, 'current password is incorrect');
    }

    await this.updateUserPassword(user.id, dto.newPassword);
    await this.deletePasswordResetTokenForUser(user.id);
    await this.revokeAllUserSessions(user.id);

    passwordChangesTotal.inc({ result: 'success' });
  };

  listUserSessions = async (userId: string) => {
    const sessions = await this.authRepository.listActiveSessionsByUserId(userId);

    authSessionsTotal.inc({ operation: 'list', result: 'success' });

    return sessions;
  };

  revokeUserSession = async (userId: string, sessionId: string, options: { failIfMissing?: boolean } = {}) => {
    const failIfMissing = options.failIfMissing ?? true;
    const result = await this.authRepository.revokeSessionById(sessionId, userId);

    if (result.count === 0) {
      authSessionsTotal.inc({ operation: 'revoke_one', result: 'not_found' });

      if (failIfMissing) {
        throw new ApiErrorHandler(404, 'session not found');
      }
    }

    await redis.del(sessionCacheKey(sessionId));

    if (result.count > 0) {
      authSessionsTotal.inc({ operation: 'revoke_one', result: 'success' });
    }
  };

  revokeAllUserSessions = async (userId: string) => {
    const sessions = await this.authRepository.listActiveSessionsByUserId(userId);

    await this.authRepository.revokeAllSessionsByUserId(userId);

    if (sessions.length > 0) {
      await redis.del(sessions.map((session) => sessionCacheKey(session.id)));
    }

    authSessionsTotal.inc({ operation: 'revoke_all', result: 'success' });
  };

  touchSession = async (sessionId: string) => {
    await this.authRepository.touchSession(sessionId);
  };

  // Helper functions
  private async updateUserPassword(userId: string, password: string) {
    const hashedPassword = await bcrypt.hash(password, config.saltRounds!);
    await this.authRepository.updatePasswordById(userId, hashedPassword);
  }

  private async deletePasswordResetTokenForUser(userId: string) {
    const tokenHash = await redis.get(passwordResetUserCacheKey(userId));

    if (tokenHash) {
      await redis.del(passwordResetTokenCacheKey(tokenHash));
    }

    await redis.del(passwordResetUserCacheKey(userId));
  }
}
