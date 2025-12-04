import { redis } from "../../config/redisClient.js";
import ApiErrorHandler from "../../utils/apiErrorHanlderClass.js";
import logger from "../../utils/logger.js";
import bcrypt from "bcrypt";
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_TTL_SECONDS = 15 * 60; // 15 minutes
const FAILURE_WINDOW_SECONDS = 15 * 60; // window in which failures accumulate
export class AuthService {
    authRepository;
    constructor(authRepository) {
        this.authRepository = authRepository;
    }
    getUserKey = (identifier) => {
        return `auth:fail:user:${identifier}`;
    };
    getLockKey = (identifier) => {
        return `auth:lock:user:${identifier}`;
    };
    isLocked = async (identifier) => {
        const lockKey = this.getLockKey(identifier);
        const locked = await redis.get(lockKey);
        return locked === "1";
    };
    recordFailedAttempt = async (context) => {
        const key = this.getUserKey(context.identifier);
        const newCount = await redis.incr(key);
        // Ensure key expires so failures don't accumulate forever
        if (newCount === 1) {
            await redis.expire(key, FAILURE_WINDOW_SECONDS);
        }
        logger.warn({
            identifier: context.identifier,
            ip: context.ip,
            userAgent: context.userAgent,
            failedAttempts: newCount,
        }, "Failed login attempt");
        if (newCount >= MAX_FAILED_ATTEMPTS) {
            const lockKey = this.getLockKey(context.identifier);
            await redis.set(lockKey, "1", { EX: LOCKOUT_TTL_SECONDS });
            logger.warn({
                identifier: context.identifier,
                ip: context.ip,
            }, "User locked due to too many failed login attempts");
        }
        return newCount;
    };
    async resetFailedAttempts(identifier) {
        const key = this.getUserKey(identifier);
        await redis.del(key);
        const lockKey = this.getLockKey(identifier);
        await redis.del(lockKey);
    }
    userLogin = async (dto, context) => {
        // Check if user is currently locked
        if (await this.isLocked(context.identifier)) {
            logger.warn({
                identifier: context.identifier,
                ip: context.ip,
            }, "Login attempt while account is locked");
            throw new ApiErrorHandler(429, "Too many failed attempts. Please try again later.");
        }
        // Find user by email or username
        const user = await this.authRepository.getUserByEmailOrUsername(dto.email, dto.username);
        if (!user) {
            await this.recordFailedAttempt(context);
            throw new ApiErrorHandler(401, "Invalid credentials");
        }
        // Check status (optional)
        if (user.status === "BLOCKED") {
            throw new ApiErrorHandler(403, "Account is blocked");
        }
        //  Verify password
        const isMatch = await bcrypt.compare(dto.password, user.password);
        if (!isMatch) {
            await this.recordFailedAttempt(context);
            throw new ApiErrorHandler(401, "Invalid credentials");
        }
        // Successful login → reset counters
        await this.resetFailedAttempts(context.identifier);
        return user;
    };
}
