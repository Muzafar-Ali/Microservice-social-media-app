import { Prisma, User } from '../../generated/prisma/client.js';
import { UserRepository } from './user.repository.js';
import { CreateUserDto, UpdateMyProfileDto, UpdateProfileImageDto } from './user.validations.js';
import ApiErrorHandler from '../../utils/apiErrorHandlerClass.js';
import bcrypt from 'bcrypt';
import config from '../../config/config.js';
import logger from '../../utils/logger.js';
import { redisCacheOperationsTotal, userProfileReadsTotal } from '../../monitoring/metrics.js';
import { userCacheKeyById, userCacheKeyByUsername } from '../../cache/cache.keys.js';
import { CACHE_TTL } from '../../cache/cache.ttl.js';
import { cacheService } from '../../cache/cache.service.js';

export type SafeUser = Omit<User, 'password'>;
export type PublicUserProfile = Omit<SafeUser, 'email'>;

export class UserService {
  constructor(private userRepository: UserRepository) {}

  async createUser(dto: CreateUserDto): Promise<SafeUser> {
    const existingUser = await this.userRepository.findByEmailOrUsername(dto.email, dto.username);

    if (existingUser) {
      if (existingUser.username === dto.username) throw new ApiErrorHandler(409, 'Username already taken');
      if (existingUser.email === dto.email) throw new ApiErrorHandler(409, 'Email already registered');
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

    // Database-level protection against concurrent duplicate inserts.
    try {
      createdUser = await this.userRepository.createUserAndQueueUserCreatedEvent({ userData });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ApiErrorHandler(409, 'Username or email already exists');
      }

      throw error;
    }

    const safeUser = this.toSafeUser(createdUser);

    // Cache the user
    try {
      await this.writeUserCache(safeUser);
    } catch (error) {
      redisCacheOperationsTotal.inc({ operation: 'write', result: 'error' });
      logger.warn({ userId: safeUser.id, error }, 'User cache write failed');
    }

    return safeUser;
  }

  async getUserByUsername(username: string): Promise<PublicUserProfile | null> {
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

    await this.writeUserCache(safeUser);

    return this.toPublicUserProfile(safeUser);
  }

  async getUserById(userId: string): Promise<PublicUserProfile | null> {
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

    await this.writeUserCache(safeUser);

    return this.toPublicUserProfile(safeUser);
  }

  updateUserProfileImage = async (dto: UpdateProfileImageDto, userId: string): Promise<SafeUser | null> => {
    const updatedUser = await this.userRepository.updateProfileImageByIdAndQueueUserUpdatedEvent(
      dto.secureUrl,
      dto.publicId,
      userId,
    );

    const safeUser = this.toSafeUser(updatedUser);

    // Cache the user
    try {
      await this.writeUserCache(safeUser);
    } catch (error) {
      redisCacheOperationsTotal.inc({ operation: 'write', result: 'error' });
      logger.warn({ userId: safeUser.id, error }, 'User cache write failed');
    }

    return safeUser;
  };

  async updateMyProfile(authenticatedUserId: string, updatePayload: UpdateMyProfileDto): Promise<SafeUser> {
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

    // Cache invalidation for old username mappings
    if (isUsernameChanging) {
      await cacheService.deleteMany([userCacheKeyById(existingUser.id), userCacheKeyByUsername(existingUser.username)]);
    }

    // Cache the user
    try {
      await this.writeUserCache(safeUser);
    } catch (error) {
      redisCacheOperationsTotal.inc({ operation: 'write', result: 'error' });
      logger.warn({ userId: safeUser.id, error }, 'User cache write failed');
    }

    return safeUser;
  }

  async followCreated(input: { eventId: string; followerId: string; followeeId: string }) {
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
  }

  async followRemoved(input: { eventId: string; followerId: string; followeeId: string }) {
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

  private toSafeUser(user: User): SafeUser {
    const { password, ...safeUser } = user;
    return safeUser;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private toPublicUserProfile(user: SafeUser): PublicUserProfile {
    const { email, ...publicUser } = user;
    return publicUser;
  }
}
