import { Prisma, Status, User } from '../../generated/prisma/client.js';
import { UserRepository } from './user.repository.js';
import { CreateUserDto, UpdateMyProfileDto, UpdateProfileImageDto } from './user.validations.js';
import ApiErrorHandler from '../../utils/apiErrorHandlerClass.js';
import bcrypt from 'bcrypt';
import config from '../../config/config.js';
import logger from '../../utils/logger.js';
import { userCacheKeyById, userCacheKeyByUsername } from '../../cache/cache.keys.js';
import { CACHE_TTL } from '../../cache/cache.ttl.js';
import { cacheService } from '../../cache/cache.service.js';
import { redisCacheOperationsTotal } from '../../monitoring/cache.metrics.js';
import {
  userCreatedTotal,
  userProfileReadsTotal,
  userServiceOperationDurationSeconds,
} from '../../monitoring/user.metrics.js';

export type SafeUser = Omit<User, 'password'>;
export type LimitedPrivateUserProfile = Pick<SafeUser, 'id' | 'username' | 'name' | 'profileImage' | 'isPrivate'>;
export type PublicUserProfile = Omit<SafeUser, 'email'> | LimitedPrivateUserProfile;

export class UserService {
  constructor(private userRepository: UserRepository) {}

  async createUser(dto: CreateUserDto): Promise<SafeUser> {
    const stopTimer = userServiceOperationDurationSeconds.startTimer({
      operation: 'create_user',
    });

    try {
      const existingUser = await this.userRepository.findByEmailOrUsername(dto.email, dto.username);

      if (existingUser) {
        if (existingUser.username === dto.username) {
          userCreatedTotal.inc({ result: 'error', reason: 'username_taken' });
          throw new ApiErrorHandler(409, 'Username already taken');
        }

        if (existingUser.email === dto.email) {
          userCreatedTotal.inc({ result: 'error', reason: 'email_registered' });
          throw new ApiErrorHandler(409, 'Email already registered');
        }
      }

      const hashedPassword = await bcrypt.hash(dto.password, config.saltRounds!);

      const userData: Prisma.UserCreateInput = {
        username: dto.username,
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        bio: dto.bio,
        profileImage: dto.profileImage,
        gender: dto.gender,
      };

      let createdUser: User;

      try {
        createdUser = await this.userRepository.createUserAndQueueUserCreatedEvent({ userData });
        userCreatedTotal.inc({ result: 'success', reason: 'created' });
      } catch (error) {
        if (this.isUniqueConstraintError(error)) {
          userCreatedTotal.inc({ result: 'error', reason: 'duplicate_race_condition' });
          throw new ApiErrorHandler(409, 'Username or email already exists');
        }

        userCreatedTotal.inc({ result: 'error', reason: 'database_error' });
        throw error;
      }

      const safeUser = this.toSafeUser(createdUser);

      try {
        await this.writeUserCache(safeUser);
      } catch (error) {
        redisCacheOperationsTotal.inc({ operation: 'write', result: 'error' });
        logger.warn({ userId: safeUser.id, error }, 'User cache write failed');
      }

      return safeUser;
    } finally {
      stopTimer();
    }
  }

  async getUserByUsername(username: string): Promise<PublicUserProfile | null> {
    const stopTimer = userServiceOperationDurationSeconds.startTimer({
      operation: 'get_user_by_username',
    });

    try {
      const cacheKey = userCacheKeyByUsername(username);

      const cachedUser = await cacheService.get(cacheKey);

      if (cachedUser) {
        userProfileReadsTotal.inc({ lookup_type: 'username', result: 'cache_hit' });
        return this.toPublicUserProfile(cachedUser as SafeUser);
      }

      const user = await this.userRepository.findByUsername(username);

      if (!user) {
        userProfileReadsTotal.inc({ lookup_type: 'username', result: 'not_found' });
        return null;
      }

      userProfileReadsTotal.inc({ lookup_type: 'username', result: 'database_hit' });

      const safeUser = this.toSafeUser(user);

      try {
        await this.writeUserCache(safeUser);
      } catch (error) {
        redisCacheOperationsTotal.inc({ operation: 'write', result: 'error' });
        logger.warn({ userId: safeUser.id, error }, 'User cache write failed');
      }

      return this.toPublicUserProfile(safeUser);
    } finally {
      stopTimer();
    }
  }

  async getUserById(userId: string): Promise<PublicUserProfile | null> {
    const stopTimer = userServiceOperationDurationSeconds.startTimer({
      operation: 'get_user_by_id',
    });

    try {
      const cacheKey = userCacheKeyById(userId);

      const cachedUser = await cacheService.get(cacheKey);

      if (cachedUser) {
        userProfileReadsTotal.inc({ lookup_type: 'id', result: 'cache_hit' });
        return this.toPublicUserProfile(cachedUser as SafeUser);
      }

      const user = await this.userRepository.findUserById(userId);

      if (!user) {
        userProfileReadsTotal.inc({ lookup_type: 'id', result: 'not_found' });
        return null;
      }

      userProfileReadsTotal.inc({ lookup_type: 'id', result: 'database_hit' });

      const safeUser = this.toSafeUser(user);

      try {
        await this.writeUserCache(safeUser);
      } catch (error) {
        redisCacheOperationsTotal.inc({ operation: 'write', result: 'error' });
        logger.warn({ userId: safeUser.id, error }, 'User cache write failed');
      }

      return this.toPublicUserProfile(safeUser);
    } finally {
      stopTimer();
    }
  }

  updateUserProfileImage = async (dto: UpdateProfileImageDto, userId: string): Promise<SafeUser | null> => {
    const stopTimer = userServiceOperationDurationSeconds.startTimer({
      operation: 'update_profile_image',
    });

    try {
      const updatedUser = await this.userRepository.updateProfileImageByIdAndQueueUserUpdatedEvent(
        dto.secureUrl,
        dto.publicId,
        userId,
      );

      const safeUser = this.toSafeUser(updatedUser);

      try {
        await this.writeUserCache(safeUser);
      } catch (error) {
        redisCacheOperationsTotal.inc({
          operation: 'write',
          result: 'error',
        });

        logger.warn(
          {
            userId: safeUser.id,
            error,
          },
          'User cache write failed',
        );
      }

      return safeUser;
    } finally {
      stopTimer();
    }
  };

  async updateMyProfile(authenticatedUserId: string, updatePayload: UpdateMyProfileDto): Promise<SafeUser> {
    const stopTimer = userServiceOperationDurationSeconds.startTimer({
      operation: 'update_my_profile',
    });

    try {
      const existingUser = await this.userRepository.findUserById(authenticatedUserId);

      if (!existingUser) {
        throw new ApiErrorHandler(404, 'user not found');
      }

      const isUsernameChanging =
        typeof updatePayload.username === 'string' &&
        updatePayload.username.length > 0 &&
        updatePayload.username !== existingUser.username;

      if (isUsernameChanging) {
        const usernameAlreadyUsed = await this.userRepository.findByUsername(updatePayload.username!);

        if (usernameAlreadyUsed) {
          throw new ApiErrorHandler(409, 'username already taken');
        }
      }

      const updatedUser = await this.userRepository.updateUserAndQueueUserUpdatedEvent(
        authenticatedUserId,
        updatePayload,
      );

      const safeUser = this.toSafeUser(updatedUser);

      if (isUsernameChanging) {
        await cacheService.deleteMany([
          userCacheKeyById(existingUser.id),
          userCacheKeyByUsername(existingUser.username),
        ]);
      }

      try {
        await this.writeUserCache(safeUser);
      } catch (error) {
        redisCacheOperationsTotal.inc({ operation: 'write', result: 'error' });
        logger.warn({ userId: safeUser.id, error }, 'User cache write failed');
      }

      return safeUser;
    } finally {
      stopTimer();
    }
  }

  async updateUserStatus(userId: string, status: Status): Promise<SafeUser> {
    const existingUser = await this.userRepository.findUserById(userId);

    if (!existingUser) {
      throw new ApiErrorHandler(404, 'user not found');
    }

    if (existingUser.status === 'DELETED') {
      throw new ApiErrorHandler(410, 'deleted accounts cannot be updated');
    }

    return this.setUserStatus(existingUser, status);
  }

  async deactivateMyAccount(authenticatedUserId: string): Promise<SafeUser> {
    const existingUser = await this.requireMutableUser(authenticatedUserId);

    return this.setUserStatus(existingUser, 'DEACTIVATED');
  }

  async reactivateMyAccount(authenticatedUserId: string): Promise<SafeUser> {
    const existingUser = await this.requireMutableUser(authenticatedUserId);

    if (existingUser.status === 'BLOCKED' || existingUser.status === 'SUSPENDED') {
      throw new ApiErrorHandler(403, 'account cannot be reactivated while blocked or suspended');
    }

    return this.setUserStatus(existingUser, 'ACTIVE');
  }

  async deleteMyAccount(authenticatedUserId: string): Promise<void> {
    const existingUser = await this.requireMutableUser(authenticatedUserId);

    await this.setUserStatus(existingUser, 'DELETED');
  }

  async followCreated(input: { eventId: string; followerId: string; followeeId: string }): Promise<void> {
    const stopTimer = userServiceOperationDurationSeconds.startTimer({
      operation: 'follow_created_projection',
    });

    try {
      const { eventId, followerId, followeeId } = input;

      const wasProcessed = await this.userRepository.applyFollowCreatedEvent({
        eventId,
        followerId,
        followeeId,
      });

      if (!wasProcessed) return;

      try {
        await Promise.all([this.refreshUserCacheById(followerId), this.refreshUserCacheById(followeeId)]);
      } catch (error) {
        redisCacheOperationsTotal.inc({ operation: 'refresh', result: 'error' });
        logger.warn({ error, followerId, followeeId }, 'User cache refresh failed');
      }
    } finally {
      stopTimer();
    }
  }

  async followRemoved(input: { eventId: string; followerId: string; followeeId: string }): Promise<void> {
    const stopTimer = userServiceOperationDurationSeconds.startTimer({
      operation: 'follow_removed_projection',
    });

    try {
      const { eventId, followerId, followeeId } = input;

      const wasProcessed = await this.userRepository.applyFollowRemovedEvent({
        eventId,
        followerId,
        followeeId,
      });

      if (!wasProcessed) return;

      try {
        await Promise.all([this.refreshUserCacheById(followerId), this.refreshUserCacheById(followeeId)]);
      } catch (error) {
        redisCacheOperationsTotal.inc({ operation: 'refresh', result: 'error' });
        logger.warn({ error, followerId, followeeId }, 'User cache refresh failed');
      }
    } finally {
      stopTimer();
    }
  }

  // Helper functions
  private async writeUserCache(safeUser: SafeUser): Promise<void> {
    await Promise.all([
      cacheService.set(userCacheKeyById(safeUser.id), safeUser, CACHE_TTL.USER),
      cacheService.set(userCacheKeyByUsername(safeUser.username), safeUser, CACHE_TTL.USER),
    ]);
  }

  private async refreshUserCacheById(userId: string): Promise<void> {
    const user = await this.userRepository.findUserById(userId);

    if (!user) {
      return;
    }

    const safeUser = this.toSafeUser(user);
    await this.writeUserCache(safeUser);
  }

  private async requireMutableUser(userId: string): Promise<User> {
    const existingUser = await this.userRepository.findUserById(userId);

    if (!existingUser) {
      throw new ApiErrorHandler(404, 'user not found');
    }

    if (existingUser.status === 'DELETED') {
      throw new ApiErrorHandler(410, 'account already deleted');
    }

    return existingUser;
  }

  private async setUserStatus(existingUser: User, status: Status): Promise<SafeUser> {
    const stopTimer = userServiceOperationDurationSeconds.startTimer({
      operation: 'set_user_status',
    });

    try {
      if (existingUser.status === status) {
        return this.toSafeUser(existingUser);
      }

      const updatedUser = await this.userRepository.updateUserStatusAndQueueUserUpdatedEvent(existingUser.id, status);
      const safeUser = this.toSafeUser(updatedUser);

      await cacheService.deleteMany([userCacheKeyById(existingUser.id), userCacheKeyByUsername(existingUser.username)]);

      try {
        await this.writeUserCache(safeUser);
      } catch (error) {
        redisCacheOperationsTotal.inc({ operation: 'write', result: 'error' });
        logger.warn({ userId: safeUser.id, error }, 'User cache write failed');
      }

      return safeUser;
    } finally {
      stopTimer();
    }
  }

  private toSafeUser(user: User): SafeUser {
    const { password, ...safeUser } = user;
    return safeUser;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private toPublicUserProfile(user: SafeUser): PublicUserProfile {
    if (user.isPrivate) {
      return {
        id: user.id,
        username: user.username,
        name: user.name,
        profileImage: user.profileImage,
        isPrivate: true,
      };
    }

    const { email, ...publicUser } = user;
    return publicUser;
  }
}
