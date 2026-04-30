import { redis } from '../../config/redisClient.js';
import { Prisma, User } from '../../generated/prisma/client.js';
import {
  getUserCacheKeyById,
  getUserCacheKeyByUsername,
  USER_CACHE_TTL_SECONDS,
} from '../../utils/cacheKeys/userCacheKeys.js';
import { UserRepository } from './user.repository.js';
import { CreateUserDto, UpdateMyProfileDto, UpdateProfileImageDto } from './user.validations.js';
import ApiErrorHandler from '../../utils/apiErrorHandlerClass.js';
import bcrypt from 'bcrypt';
import config from '../../config/config.js';
import logger from '../../utils/logger.js';

export type SafeUSer = Omit<User, 'password'>;

export class UserService {
  constructor(
    private userRepository: UserRepository,
  ) {}

  async createUser(dto: CreateUserDto): Promise<SafeUSer> {
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

    const createdUser = await this.userRepository.createUserAndQueueUserCreatedEvent({ userData });

    const safeUser = this.toSafeUser(createdUser);

    // Cache the user
    try {
      await this.writeUserCache(safeUser);
    } catch (error) {
      logger.warn({ userId: safeUser.id, error }, 'User cache write failed');
    }

    return safeUser;
  }

  async getUserByUsername(username: string): Promise<SafeUSer | null> {
    // Check if user is cached already by username
    const cacheKey = getUserCacheKeyByUsername(username);
    let cached = null;
    
    try {
      cached = await redis.get(cacheKey);
    } catch (error) {
      logger.warn({ error, cacheKey }, 'Cache read failed');
    }

    if (cached) {
      const parsed = JSON.parse(cached);
      return {
        ...parsed,
        createdAt: new Date(parsed.createdAt),
        updatedAt: new Date(parsed.updatedAt),
      };
    }

    // Otherwise get from database
    const user = await this.userRepository.findByUsername(username);
    if (!user) return null;

    const safeUser = this.toSafeUser(user);

    // Cache the user
    try {
      await this.writeUserCache(safeUser);
    } catch (error) {
      logger.warn({ userId: safeUser.id, error }, 'User cache write failed');
    }

    return safeUser;
  }

  async getUserById(userId: string): Promise<SafeUSer | null> {
    const cacheKey = getUserCacheKeyById(userId);
    let cached = null;
    
    try {
      cached = await redis.get(cacheKey);
    } catch (error) {
      logger.warn({ error, cacheKey }, 'Cache read failed');
    }

    if (cached) {
      const parsed = JSON.parse(cached);
      return {
        ...parsed,
        createdAt: new Date(parsed.createdAt),
        updatedAt: new Date(parsed.updatedAt),
      };
    }

    const user = await this.userRepository.findUserById(userId);
    if (!user) return null;

    const safeUser = this.toSafeUser(user);

    // Cache the user
    try {
      await this.writeUserCache(safeUser);
    } catch (error) {
      logger.warn({ userId: safeUser.id, error }, 'User cache write failed');
    }

    return safeUser;
  }

  updateUserProfileImage = async (dto: UpdateProfileImageDto, userId: string): Promise<SafeUSer | null> => {
    
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
      logger.warn({ userId: safeUser.id, error }, 'User cache write failed');
    }

    return safeUser;
  };

  async updateMyProfile(authenticatedUserId: string, updatePayload: UpdateMyProfileDto): Promise<SafeUSer> {
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
      await this.deleteUserCacheByIdentity(existingUser.id, existingUser.username);
    }

    // Cache the user
    try {
      await this.writeUserCache(safeUser);
    } catch (error) {
      logger.warn({ userId: safeUser.id, error }, 'User cache write failed');
    }

    return safeUser;
  }

  async followCreated(followerId: string, followeeId: string) {
    await Promise.all([
      this.userRepository.incrementFollowingCount(followerId, 1),
      this.userRepository.incrementFollowersCount(followeeId, 1),
    ]);

    try {
      await Promise.all([
        this.refreshUserCacheById(followerId),
        this.refreshUserCacheById(followeeId),
      ]);
    } catch (error) {
      logger.warn({ error, followerId, followeeId }, 'User cache refresh failed');
    }
  }

  async followRemoved(followerId: string, followeeId: string) {
    await Promise.all([
      this.userRepository.incrementFollowingCount(followerId, -1),
      this.userRepository.incrementFollowersCount(followeeId, -1),
    ]);

    try {
      await Promise.all([
        this.refreshUserCacheById(followerId),
        this.refreshUserCacheById(followeeId),
      ]);
    } catch (error) {
      logger.warn({ error, followerId, followeeId }, 'User cache refresh failed');
    }
  }

  // Helper functions
  private toSafeUser(user: User): SafeUSer {
    const { password, ...safeUser } = user;
    return safeUser;
  }

  private async writeUserCache(safeUser: SafeUSer): Promise<void> {
    await Promise.all([
      redis.set(getUserCacheKeyById(safeUser.id), JSON.stringify(safeUser), { EX: USER_CACHE_TTL_SECONDS }),
      redis.set(getUserCacheKeyByUsername(safeUser.username), JSON.stringify(safeUser), { EX: USER_CACHE_TTL_SECONDS }),
    ]);
  }

  private async deleteUserCacheByIdentity(userId: string, username: string): Promise<void> {
    try {
      await redis.del([
        getUserCacheKeyById(userId),
        getUserCacheKeyByUsername(username),
      ]);
    } catch (error) {
      logger.warn(
        { userId, username, error },
        'User cache delete failed'
      );
    }
  }

  private async refreshUserCacheById(userId: string): Promise<void> {
    const user = await this.userRepository.findUserById(userId);

    if (!user) {
      return;
    }

    const safeUser = this.toSafeUser(user);
    await this.writeUserCache(safeUser);
  }
}
