import ApiErrorHandler from '../../utils/apiErrorHandlerClass.js';
import logger from '../../utils/logger.js';
import { AuthRepository } from './auth.repository.js';
import { UserLoginDto } from './auth.schema.js';
import bcrypt from 'bcrypt';
import { TLoginContext } from './auth.types.js';
import { isLoginLocked, recordFailedLoginAttempt, resetFailedLoginAttempts } from '../../utils/loginAttemptsTracker.js';
import { authLoginAttemptsTotal } from '../../monitoring/metrics.js';

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

    // Check status (optional)
    if (user.status === 'BLOCKED') {
      authLoginAttemptsTotal.inc({ result: 'blocked', reason: 'account_blocked' });
      throw new ApiErrorHandler(403, 'Account is blocked');
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
}
