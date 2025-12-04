import { redis } from '../../config/redisClient.js';
import { Prisma, User } from '../../generated/prisma/client.js';
import { USER_CACHE_TTL_SECONDS, userCacheKeyById, userCacheKeyByUsername } from '../../utils/cache/userCacheKeys.js';
import { publishUserEvent } from '../../utils/rabbitmq.js';
import { UserRepository } from './user.repository.js';
import { CreateUserDto } from './user.schema.js';
import ApiErrorHandler from '../../utils/apiErrorHanlderClass.js';
import { UserEventPublisher } from '../../events/producers.js';


export class UserService {

  constructor(
    private userRepository: UserRepository,
    private userEventPublisher: UserEventPublisher
  ) {}

  async createUser(dto: CreateUserDto): Promise<User> {

    const prismaData: Prisma.UserCreateInput = {
      username: dto.username,
      name: dto.name,
      email: dto.email,
      password: dto.password,
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

    await Promise.all([
      redis.set(userCacheKeyById(user.id), JSON.stringify(user), {
        EX: USER_CACHE_TTL_SECONDS,
      }),

      redis.set(userCacheKeyByUsername(user.username), JSON.stringify(user), {
        EX: USER_CACHE_TTL_SECONDS,
      })
    ])

    // Publish user created event for other services (notification, search, etc.)
    await this.userEventPublisher.publishUserCreated({
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
      createdAt: user.createdAt
    })

    // If user uploaded a profile image at signup → send to media-service
    if(dto.profileImage) {
      await this.userEventPublisher.publishProfileImageUploadRequested({
        userId: user.id,
        rawImage: dto.profileImage
      })
    }
    
    return user
  }

  async getUserByUsername(username: string): Promise<User | null> {
    // Check if user is cached already by username
    const cacheKey = userCacheKeyByUsername(username);
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

    // Cache the user
    await Promise.all([
      redis.set(userCacheKeyById(user.id), JSON.stringify(user), {
        EX: USER_CACHE_TTL_SECONDS,
      }),
      redis.set(userCacheKeyByUsername(user.username), JSON.stringify(user), {
        EX: USER_CACHE_TTL_SECONDS,
      }),
    ]);

    return user;
  }

  async getUserById(id: number): Promise<User | null> {
    
    const cacheKey = userCacheKeyById(id);
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      return {
        ...parsed,
        createdAt: new Date(parsed.createdAt),
        updatedAt: new Date(parsed.updatedAt),
      };
    }

    const user = await this.userRepository.findById(id);
    if (!user) return null;

    await Promise.all([
      redis.set(userCacheKeyById(user.id), JSON.stringify(user), {
        EX: USER_CACHE_TTL_SECONDS,
      }),
      redis.set(userCacheKeyByUsername(user.username), JSON.stringify(user), {
        EX: USER_CACHE_TTL_SECONDS,
      }),
    ]);

    return user;
  }

  // async updateUser(id: string, rawData: unknown): Promise<User> {
  //   const parsed = updateUserSchema.parse(rawData);

  //   const prismaData: Prisma.UserUpdateInput = {
  //     name: parsed.name ?? undefined,
  //     bio: parsed.bio ?? undefined,
  //     profileImage: parsed.profileImage ?? undefined,
  //     gender: parsed.gender ?? undefined,
  //     isPrivate: parsed.isPrivate ?? undefined,
  //   };

  //   const user = await this.userRepository.updateUser(id, prismaData);

  //   await Promise.all([
  //     redisClient.set(userCacheKeyById(user.id), JSON.stringify(user), {
  //       EX: USER_CACHE_TTL_SECONDS,
  //     }),
  //     redisClient.set(userCacheKeyByUsername(user.username), JSON.stringify(user), {
  //       EX: USER_CACHE_TTL_SECONDS,
  //     }),
  //   ]);

  //   return user;
  // }

  // async bulkGetByIds(raw: unknown): Promise<User[]> {
  //   const { ids } = bulkUserLookupSchema.parse(raw);
  //   return this.userRepository.bulkFindByIds(ids);
  // }

  // async handleFollowerCountChange(userId: string, delta: number): Promise<void> {
  //   const user = await this.userRepository.incrementFollowersCount(userId, delta);
  //   await redisClient.set(userCacheKeyById(user.id), JSON.stringify(user), {
  //     EX: USER_CACHE_TTL_SECONDS,
  //   });
  // }

  // async handleFollowingCountChange(userId: string, delta: number): Promise<void> {
  //   const user = await this.userRepository.incrementFollowingCount(userId, delta);
  //   await redisClient.set(userCacheKeyById(user.id), JSON.stringify(user), {
  //     EX: USER_CACHE_TTL_SECONDS,
  //   });
  // }
}