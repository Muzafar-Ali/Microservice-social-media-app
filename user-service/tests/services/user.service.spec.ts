import { UserService } from '../../src/services/user.service';
import { UserRepository } from '../../src/repositories/user.repository';
import { redis } from '../../src/config/redisClient'; // Import the mocked redis
import * as rabbitmq from '../../src/utils/rabbitmq';
import { CreateUserDto } from '../../src/schema/user.schema';
import ApiErrorHandler from '../../src/utils/apiErrorHanlderClass';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { User } from '../../src/generated/prisma/client';
import { USER_CACHE_TTL_SECONDS, userCacheKeyById, userCacheKeyByUsername } from '../../src/utils/cache/userCacheKeys';

// Tell Jest to use the manual mock we created in src/config/__mocks__/redisClient.ts
jest.mock('../../src/config/redisClient');

// Cast the imported mocked redis to its deep mock proxy type for type-safe access
const mockRedis = redis as DeepMockProxy<typeof redis>;

describe('UserService', () => {
  let userService: UserService;
  let mockUserRepository: DeepMockProxy<UserRepository>;
  let mockPublishUserEvent: jest.Mock;

  beforeEach(() => {
    // Reset mocks before each test
    mockUserRepository = mockDeep<UserRepository>();
    mockRedis.mockClear(); // Clear the auto-mocked redis client
    mockPublishUserEvent = jest.fn();

    jest.spyOn(rabbitmq, 'publishUserEvent').mockImplementation(mockPublishUserEvent);

    userService = new UserService(mockUserRepository);
  });

  describe('createUser', () => {
    const createUserDto: CreateUserDto = {
      username: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      bio: 'This is a test bio',
      profileImage: 'http://example.com/profile.jpg',
      gender: 'male',
      isActive: true,
    };

    const createdUser: User = {
      id: 1,
      username: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      bio: 'This is a test bio',
      profileImage: 'http://example.com/profile.jpg',
      gender: 'male',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      followersCount: 0,
      followingCount: 0,
    };

    it('should successfully create a new user', async () => {
      mockUserRepository.findByEmailOrUsername.mockResolvedValue(null);
      mockUserRepository.createUser.mockResolvedValue(createdUser);
      mockRedis.set.mockResolvedValue('OK');

      const result = await userService.createUser(createUserDto);

      expect(result).toEqual(createdUser);
      expect(mockUserRepository.findByEmailOrUsername).toHaveBeenCalledWith(createUserDto.email, createUserDto.username);
      expect(mockUserRepository.createUser).toHaveBeenCalledWith({
        username: createUserDto.username,
        name: createUserDto.name,
        email: createUserDto.email,
        bio: createUserDto.bio,
        profileImage: createUserDto.profileImage,
        gender: createUserDto.gender,
      });
      expect(mockRedis.set).toHaveBeenCalledWith(userCacheKeyById(createdUser.id), JSON.stringify(createdUser), { EX: USER_CACHE_TTL_SECONDS });
      expect(mockRedis.set).toHaveBeenCalledWith(userCacheKeyByUsername(createdUser.username), JSON.stringify(createdUser), { EX: USER_CACHE_TTL_SECONDS });
      expect(mockPublishUserEvent).toHaveBeenCalledWith('user.created', {
        id: createdUser.id,
        username: createdUser.username,
        name: createdUser.name,
        createdAt: createdUser.createdAt,
      });
    });

    it('should throw ApiErrorHandler if username already exists', async () => {
      mockUserRepository.findByEmailOrUsername.mockResolvedValue({ ...createdUser, email: 'different@example.com' });

      await expect(userService.createUser(createUserDto)).rejects.toThrow(
        new ApiErrorHandler(409, 'Username already taken')
      );
      expect(mockUserRepository.findByEmailOrUsername).toHaveBeenCalledWith(createUserDto.email, createUserDto.username);
      expect(mockUserRepository.createUser).not.toHaveBeenCalled();
      expect(mockRedis.set).not.toHaveBeenCalled();
      expect(mockPublishUserEvent).not.toHaveBeenCalled();
    });

    it('should throw ApiErrorHandler if email already exists', async () => {
      mockUserRepository.findByEmailOrUsername.mockResolvedValue({ ...createdUser, username: 'differentuser' });

      await expect(userService.createUser(createUserDto)).rejects.toThrow(
        new ApiErrorHandler(409, 'Email already registered')
      );
      expect(mockUserRepository.findByEmailOrUsername).toHaveBeenCalledWith(createUserDto.email, createUserDto.username);
      expect(mockUserRepository.createUser).not.toHaveBeenCalled();
      expect(mockRedis.set).not.toHaveBeenCalled();
      expect(mockPublishUserEvent).not.toHaveBeenCalled();
    });
  });

  describe('getUserByUsername', () => {
    const username = 'testuser';
    const user: User = {
      id: 1,
      username: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      bio: 'This is a test bio',
      profileImage: 'http://example.com/profile.jpg',
      gender: 'male',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      followersCount: 0,
      followingCount: 0,
    };

    it('should return user from cache if found', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(user));

      const result = await userService.getUserByUsername(username);

      expect(result).toEqual(user);
      expect(mockRedis.get).toHaveBeenCalledWith(userCacheKeyByUsername(username));
      expect(mockUserRepository.findByUsername).not.toHaveBeenCalled();
      expect(mockRedis.set).not.toHaveBeenCalled(); // Should not set if already in cache
    });

    it('should return user from database and cache it if not in cache', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockUserRepository.findByUsername.mockResolvedValue(user);
      mockRedis.set.mockResolvedValue('OK');

      const result = await userService.getUserByUsername(username);

      expect(result).toEqual(user);
      expect(mockRedis.get).toHaveBeenCalledWith(userCacheKeyByUsername(username));
      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith(username);
      expect(mockRedis.set).toHaveBeenCalledWith(userCacheKeyById(user.id), JSON.stringify(user), { EX: USER_CACHE_TTL_SECONDS });
      expect(mockRedis.set).toHaveBeenCalledWith(userCacheKeyByUsername(user.username), JSON.stringify(user), { EX: USER_CACHE_TTL_SECONDS });
    });

    it('should return null if user not found in cache or database', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockUserRepository.findByUsername.mockResolvedValue(null);

      const result = await userService.getUserByUsername(username);

      expect(result).toBeNull();
      expect(mockRedis.get).toHaveBeenCalledWith(userCacheKeyByUsername(username));
      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith(username);
      expect(mockRedis.set).not.toHaveBeenCalled();
    });
  });

  describe('getUserById', () => {
    const userId = 1;
    const user: User = {
      id: 1,
      username: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      bio: 'This is a test bio',
      profileImage: 'http://example.com/profile.jpg',
      gender: 'male',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      followersCount: 0,
      followingCount: 0,
    };

    it('should return user from cache if found', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(user));

      const result = await userService.getUserById(userId);

      expect(result).toEqual(user);
      expect(mockRedis.get).toHaveBeenCalledWith(userCacheKeyById(userId));
      expect(mockUserRepository.findById).not.toHaveBeenCalled();
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should return user from database and cache it if not in cache', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockUserRepository.findById.mockResolvedValue(user);
      mockRedis.set.mockResolvedValue('OK');

      const result = await userService.getUserById(userId);

      expect(result).toEqual(user);
      expect(mockRedis.get).toHaveBeenCalledWith(userCacheKeyById(userId));
      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(mockRedis.set).toHaveBeenCalledWith(userCacheKeyById(user.id), JSON.stringify(user), { EX: USER_CACHE_TTL_SECONDS });
      expect(mockRedis.set).toHaveBeenCalledWith(userCacheKeyByUsername(user.username), JSON.stringify(user), { EX: USER_CACHE_TTL_SECONDS });
    });

    it('should return null if user not found in cache or database', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockUserRepository.findById.mockResolvedValue(null);

      const result = await userService.getUserById(userId);

      expect(result).toBeNull();
      expect(mockRedis.get).toHaveBeenCalledWith(userCacheKeyById(userId));
      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(mockRedis.set).not.toHaveBeenCalled();
    });
  });
});
