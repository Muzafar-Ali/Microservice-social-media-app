import { redis } from '../../config/redisClient.js';
import { USER_CACHE_TTL_SECONDS, userCacheKeyById, userCacheKeyByUsername } from '../../utils/cache/userCacheKeys.js';
import ApiErrorHandler from '../../utils/apiErrorHanlderClass.js';
import bcrypt from "bcrypt";
import config from '../../config/config.js';
export class UserService {
    userRepository;
    userEventPublisher;
    constructor(userRepository, userEventPublisher) {
        this.userRepository = userRepository;
        this.userEventPublisher = userEventPublisher;
    }
    async createUser(dto) {
        const hashedPassword = await bcrypt.hash(dto.password, config.saltRounds);
        const prismaData = {
            username: dto.username,
            name: dto.name,
            email: dto.email,
            password: hashedPassword,
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
        // Publish user created event for other services (notification, search, etc.)
        await this.userEventPublisher.publishUserCreated({
            id: user.id,
            email: user.email,
            name: user.name,
            username: user.username,
            createdAt: user.createdAt
        });
        // If user uploaded a profile image at signup → send to media-service
        if (dto.profileImage) {
            await this.userEventPublisher.publishProfileImageUploadRequested({
                userId: user.id,
                rawImage: dto.profileImage
            });
        }
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
    updateUserProfileImage = async (dto, userId) => {
        const updatedUser = await this.userRepository.updateProfileImage(dto.secureUrl, dto.publicId, userId);
        const { password, ...safeUser } = updatedUser;
        return safeUser;
    };
}
