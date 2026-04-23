import { redis } from '../../config/redisClient.js';
import { Prisma, User } from '../../generated/prisma/client.js';
import { getUserCacheKeyById, getUserCacheKeyByUsername, USER_CACHE_TTL_SECONDS } from '../../utils/cacheKeys/userCacheKeys.js';
import { UserRepository } from './user.repository.js';
import { CreateUserDto, UpdateMyProfileDto, UpdateProfileImageDto } from './user.validations.js';
import ApiErrorHandler from '../../utils/apiErrorHanlderClass.js';
import { UserEventPublisher } from '../../events/producers.js';
import bcrypt from "bcrypt"
import config from '../../config/config.js';

export type SafeUSer = Omit<User, "password">

export class UserService {

  constructor(
    private userRepository: UserRepository,
    private userEventPublisher: UserEventPublisher
  ) {}

  async createUser(dto: CreateUserDto): Promise<SafeUSer> {

    const hashedPassword = await bcrypt.hash(dto.password, config.saltRounds!)

    const prismaData: Prisma.UserCreateInput = {
      username: dto.username,
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      bio: dto.bio,
      profileImage: dto.profileImage,
      gender: dto.gender as any,
    };
    const exist = await this.userRepository.findByEmailOrUsername(dto.email, dto.username);

    if(exist) {
      if (exist.username === dto.username) throw new ApiErrorHandler(409, "Username already taken");
      if (exist.email === dto.email) throw new ApiErrorHandler(409, "Email already registered");
    }

    const user = await this.userRepository.createUser(prismaData);
    const safeUser = this.toSafeUser(user)

    // Cache the user
    await this.writeUserCache(safeUser);

    // for type
    const image = user.profileImage as {
      secureUrl: string;
      publicId: string;
    } | null ;
    
    // Publish user created event
    await this.userEventPublisher.publishUserCreated({
      userId: user.id,
      displayName: user.name,
      username: user.username,
      avatarUrl: image,
      status: user.status,
      createdAt: user.createdAt.toISOString()
    })
    
    return safeUser
  }

  async getUserByUsername(username: string): Promise<SafeUSer | null> {
    // Check if user is cached already by username
    const cacheKey = getUserCacheKeyByUsername(username);
    const cached = await redis.get(cacheKey);

    if(cached) {
      const parsed = JSON.parse(cached);
      return {
        ...parsed,
        createdAt: new Date(parsed.createdAt),
        updatedAt: new Date(parsed.updatedAt),
      };
    }

     // Otherwise get from database
    const user = await this.userRepository.findByUsername(username);
    if(!user) return null;

    const safeUser = this.toSafeUser(user);

    // Cache the user
    await this.writeUserCache(safeUser);

    return safeUser;
  }

  async getUserById(userId: string): Promise<SafeUSer | null> {
    
    const cacheKey = getUserCacheKeyById(userId);
    const cached = await redis.get(cacheKey);

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
    await this.writeUserCache(safeUser);

    return safeUser;
  }

  updateUserProfileImage = async (
    dto: UpdateProfileImageDto,
    userId: string
  ): Promise<SafeUSer | null> => {
    const updatedUser = await this.userRepository.updateProfileImageById(
      dto.secureUrl,
      dto.publicId,
      userId
    );

    const safeUser = this.toSafeUser(updatedUser);

    await this.writeUserCache(safeUser);

    return safeUser;
  };

  async updateMyProfile(authenticatedUserId: string, updatePayload: UpdateMyProfileDto) {
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

    const updatedUser = await this.userRepository.updateUser(authenticatedUserId, updatePayload);
    const safeUser = this.toSafeUser(updatedUser);

    if (isUsernameChanging) {
      await this.deleteUserCacheByIdentity(existingUser.id, existingUser.username);
    }

    await this.writeUserCache(safeUser);

    return updatedUser;
  }

  async handleFollowCreated(followerId: string, followeeId: string) {
    await Promise.all([
      this.userRepository.incrementFollowingCount(followerId, 1),
      this.userRepository.incrementFollowersCount(followeeId, 1),
    ]);

    await Promise.all([
      this.refreshUserCacheById(followerId),
      this.refreshUserCacheById(followeeId),
    ]);
  };

  async handleFollowRemoved(followerId: string, followeeId: string) {
    await Promise.all([
      this.userRepository.incrementFollowingCount(followerId, -1),
      this.userRepository.incrementFollowersCount(followeeId, -1),
    ]);

    await Promise.all([
      this.refreshUserCacheById(followerId),
      this.refreshUserCacheById(followeeId),
    ]);
  };

  // Helper functions
  private toSafeUser(user: User): SafeUSer {
    const { password, ...safeUser } = user;
    return safeUser;
  }

  private async writeUserCache(safeUser: SafeUSer): Promise<void> {
    await Promise.all([
      redis.set(
        getUserCacheKeyById(safeUser.id),
        JSON.stringify(safeUser),
        { EX: USER_CACHE_TTL_SECONDS }
      ),
      redis.set(
        getUserCacheKeyByUsername(safeUser.username),
        JSON.stringify(safeUser),
        { EX: USER_CACHE_TTL_SECONDS }
      ),
    ]);
  }
 
  private async deleteUserCacheByIdentity(userId: string, username: string): Promise<void> {
    await redis.del([
      getUserCacheKeyById(userId),
      getUserCacheKeyByUsername(username),
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
}