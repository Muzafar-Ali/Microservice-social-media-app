import { redis } from '../../config/redisClient.js';
import { USER_CACHE_TTL_SECONDS, userCacheKeyById, userCacheKeyByUsername } from '../../utils/cache/userCacheKeys.js';
import { publishUserEvent } from '../../utils/rabbitmq.js';
import ApiErrorHandler from '../../utils/apiErrorHanlderClass.js';
export class UserService {
    userRepository;
    constructor(userRepository) {
        this.userRepository = userRepository;
    }
    async createUser(dto) {
        const prismaData = {
            username: dto.username,
            name: dto.name,
            email: dto.email,
            password: dto.password,
            bio: dto.bio,
            profileImage: dto.profileImage,
            gender: dto.gender,
        };
        const exist = await this.userRepository.findByEmailOrUsername(dto.email, dto.username);
        if (exist) {
            if (exist.username === dto.username)
                throw new ApiErrorHandler(409, "Username already taken");
            if (exist.email === dto.email)
                throw new ApiErrorHandler(409, "Email already registered");
        }
        const user = await this.userRepository.createUser(prismaData);
        await Promise.all([
            redis.set(userCacheKeyById(user.id), JSON.stringify(user), {
                EX: USER_CACHE_TTL_SECONDS,
            }),
            redis.set(userCacheKeyByUsername(user.username), JSON.stringify(user), {
                EX: USER_CACHE_TTL_SECONDS,
            })
        ]);
        // Publish event for other services (notification, search, etc.)
        await publishUserEvent("user.created", {
            id: user.id,
            username: user.username,
            name: user.name,
            createdAt: user.createdAt,
        });
        return user;
    }
    async getUserByUsername(username) {
        // Check if user is cached already by username
        const cacheKey = userCacheKeyByUsername(username);
        const cached = await redis.get(cacheKey);
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
        if (!user)
            return null;
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
    async getUserById(id) {
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
        if (!user)
            return null;
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
}
