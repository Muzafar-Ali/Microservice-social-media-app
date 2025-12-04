import { redis } from "../../config/redisClient.js";
import ApiErrorHandler from "../../utils/apiErrorHanlderClass.js"
import logger from "../../utils/logger.js";
import { AuthRepository } from "./auth.repository.js"
import { UserLoginDto } from "./auth.schema.js"
import bcrypt from "bcrypt";
import { TLoginContext } from "./auth.types.js";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_TTL_SECONDS = 15 * 60; // 15 minutes
const FAILURE_WINDOW_SECONDS = 15 * 60; // window in which failures accumulate

export class AuthService {
  
  constructor(private authRepository: AuthRepository) {}

  private getUserKey = (identifier: string) => {
    return `auth:fail:user:${identifier}`
  }
  
  private getLockKey = (identifier: string) => {
    return `auth:lock:user:${identifier}`;
  }

private isLocked = async (identifier: string) => {
  const lockKey = this.getLockKey(identifier);
  const locked = await redis.get(lockKey);

  return locked === "1";
};


  private recordFailedAttempt = async (context: TLoginContext) => {
    const key = this.getUserKey(context.identifier);
    const newCount = await redis.incr(key);

    // Ensure key expires so failures don't accumulate forever
    if(newCount === 1) {
      await redis.expire(key, FAILURE_WINDOW_SECONDS);
    }

    logger.warn(
      {
        identifier: context.identifier,
        ip: context.ip,
        userAgent: context.userAgent,
        failedAttempts: newCount,
      },

      "Failed login attempt"
    );

    if(newCount >= MAX_FAILED_ATTEMPTS) {
      const lockKey = this.getLockKey(context.identifier);
      await redis.set(lockKey, "1", { EX: LOCKOUT_TTL_SECONDS});
      
      logger.warn(
        {
          identifier: context.identifier,
          ip: context.ip,
        },
        "User locked due to too many failed login attempts"
      );
    }

    return newCount;
  }

  private async resetFailedAttempts(identifier: string): Promise<void> {
    const key = this.getUserKey(identifier);
    await redis.del(key);

    const lockKey = this.getLockKey(identifier);
    await redis.del(lockKey);
  }

  userLogin = async (dto: UserLoginDto, context: TLoginContext) => {
    
    // Check if user is currently locked
    if( await this.isLocked(context.identifier) ) {
      logger.warn(
        {
          identifier: context.identifier,
          ip: context.ip,
        },
        "Login attempt while account is locked"
      );

      throw new ApiErrorHandler(429, "Too many failed attempts. Please try again later.");
    }

    // Find user by email or username
    const user = await this.authRepository.getUserByEmailOrUsername(dto.email, dto.username)

    if(!user) {
      await this.recordFailedAttempt(context);
      throw new ApiErrorHandler(401, "Invalid credentials");
    }

    // Check status (optional)
    if (user.status === "BLOCKED") {
      throw new ApiErrorHandler(403, "Account is blocked");
    }
    
    //  Verify password
    const isMatch = await bcrypt.compare(dto.password, user.password);
    if(!isMatch) {
      await this.recordFailedAttempt(context);
      throw new ApiErrorHandler(401, "Invalid credentials");
    } 
    
    // Successful login → reset counters
    await this.resetFailedAttempts(context.identifier);

    return user
  }
}