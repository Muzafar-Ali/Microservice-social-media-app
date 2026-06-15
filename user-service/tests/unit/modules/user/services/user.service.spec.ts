import { jest } from '@jest/globals';
import bcrypt from 'bcrypt';
import { Prisma, Status, User } from '../../../../../src/generated/prisma/client.js';

jest.mock('../../../../../src/generated/prisma/client.js', () => {
  class PrismaClientKnownRequestError extends Error {
    code: string;
    clientVersion: string;
    meta?: Record<string, unknown>;

    constructor(
      message: string,
      options: {
        code: string;
        clientVersion: string;
        meta?: Record<string, unknown>;
      },
    ) {
      super(message);
      this.name = 'PrismaClientKnownRequestError';
      this.code = options.code;
      this.clientVersion = options.clientVersion;
      this.meta = options.meta;
    }
  }

  return {
    Prisma: {
      PrismaClientKnownRequestError,
    },
  };
});

jest.mock('bcrypt', () => ({
  __esModule: true,
  default: {
    hash: jest.fn(),
  },
}));

jest.mock('../../../../../src/config/config.js', () => ({
  __esModule: true,
  default: {
    saltRounds: 12,
  },
}));

jest.mock('../../../../../src/cache/cache.service.js', () => ({
  cacheService: {
    get: jest.fn(),
    set: jest.fn(),
    deleteMany: jest.fn(),
  },
}));

jest.mock('../../../../../src/utils/logger.js', () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
  },
}));

const stopTimer = jest.fn();

jest.mock('../../../../../src/monitoring/user.metrics.js', () => ({
  userCreatedTotal: { inc: jest.fn() },
  userProfileReadsTotal: { inc: jest.fn() },
  userServiceOperationDurationSeconds: {
    startTimer: jest.fn(() => stopTimer),
  },
}));

jest.mock('../../../../../src/monitoring/cache.metrics.js', () => ({
  redisCacheOperationsTotal: { inc: jest.fn() },
}));

import { cacheService } from '../../../../../src/cache/cache.service.js';
import { CACHE_TTL } from '../../../../../src/cache/cache.ttl.js';
import { userCacheKeyById, userCacheKeyByUsername } from '../../../../../src/cache/cache.keys.js';
import { redisCacheOperationsTotal } from '../../../../../src/monitoring/cache.metrics.js';
import {
  userCreatedTotal,
  userProfileReadsTotal,
  userServiceOperationDurationSeconds,
} from '../../../../../src/monitoring/user.metrics.js';
import { UserService } from '../../../../../src/modules/user/user.service.js';
import logger from '../../../../../src/utils/logger.js';

const mockCache = jest.mocked(cacheService);
const mockBcryptHash = jest.mocked(bcrypt.hash);
const mockLogger = jest.mocked(logger);

const createUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  username: 'alice',
  name: 'Alice Example',
  email: 'alice@example.com',
  password: 'stored-password-hash',
  bio: 'Hello',
  profileImage: {
    secureUrl: 'https://cdn.example.com/alice.jpg',
    publicId: 'users/alice',
  },
  gender: 'female',
  status: 'ACTIVE',
  role: 'USER',
  isPrivate: false,
  followersCount: 7,
  followingCount: 3,
  createdAt: new Date('2026-01-10T10:00:00.000Z'),
  updatedAt: new Date('2026-02-20T12:30:00.000Z'),
  ...overrides,
});

const toSafeUser = (user: User): Omit<User, 'password'> => {
  const safeUser: Partial<User> = { ...user };
  delete safeUser.password;
  return safeUser as Omit<User, 'password'>;
};

const createUserDto = () => ({
  username: 'alice',
  name: 'Alice Example',
  email: 'alice@example.com',
  password: 'Password123!',
  bio: 'Hello',
  profileImage: {
    secureUrl: 'https://cdn.example.com/alice.jpg',
    publicId: 'users/alice',
  },
  gender: 'female' as const,
});

const mockRepository = {
  findByEmailOrUsername: jest.fn<(email: string, username: string) => Promise<User | null>>(),
  createUserAndQueueUserCreatedEvent: jest.fn<
    (input: { userData: Prisma.UserCreateInput }) => Promise<User>
  >(),
  findByUsername: jest.fn<(username: string) => Promise<User | null>>(),
  findUserById: jest.fn<(userId: string) => Promise<User | null>>(),
  updateProfileImageByIdAndQueueUserUpdatedEvent: jest.fn<
    (secureUrl: string, publicId: string, userId: string) => Promise<User>
  >(),
  updateUserAndQueueUserUpdatedEvent: jest.fn<(userId: string, data: object) => Promise<User>>(),
  updateUserStatusAndQueueUserUpdatedEvent: jest.fn<(userId: string, status: Status) => Promise<User>>(),
  applyFollowCreatedEvent: jest.fn<
    (input: { eventId: string; followerId: string; followeeId: string }) => Promise<boolean>
  >(),
  applyFollowRemovedEvent: jest.fn<
    (input: { eventId: string; followerId: string; followeeId: string }) => Promise<boolean>
  >(),
};

describe('UserService', () => {
  let userService: UserService;

  beforeEach(() => {
    jest.clearAllMocks();

    userService = new UserService(mockRepository as never);

    mockRepository.findByEmailOrUsername.mockResolvedValue(null);
    mockRepository.createUserAndQueueUserCreatedEvent.mockResolvedValue(createUser());
    mockRepository.findByUsername.mockResolvedValue(null);
    mockRepository.findUserById.mockResolvedValue(null);
    mockRepository.updateProfileImageByIdAndQueueUserUpdatedEvent.mockResolvedValue(createUser());
    mockRepository.updateUserAndQueueUserUpdatedEvent.mockResolvedValue(createUser());
    mockRepository.updateUserStatusAndQueueUserUpdatedEvent.mockResolvedValue(createUser());
    mockRepository.applyFollowCreatedEvent.mockResolvedValue(true);
    mockRepository.applyFollowRemovedEvent.mockResolvedValue(true);

    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(undefined);
    mockCache.deleteMany.mockResolvedValue(undefined);
    mockBcryptHash.mockResolvedValue('hashed-new-password' as never);
  });

  describe('createUser', () => {
    it('creates the user and outbox event with a hashed password, returns no password, and populates both caches', async () => {
      // Arrange
      const dto = createUserDto();
      const createdUser = createUser();
      const safeUser = toSafeUser(createdUser);
      mockRepository.createUserAndQueueUserCreatedEvent.mockResolvedValue(createdUser);

      // Act
      const result = await userService.createUser(dto);

      // Assert
      expect(mockRepository.findByEmailOrUsername).toHaveBeenCalledTimes(1);
      expect(mockRepository.findByEmailOrUsername).toHaveBeenCalledWith('alice@example.com', 'alice');
      expect(mockBcryptHash).toHaveBeenCalledTimes(1);
      expect(mockBcryptHash).toHaveBeenCalledWith('Password123!', 12);
      expect(mockRepository.createUserAndQueueUserCreatedEvent).toHaveBeenCalledTimes(1);
      expect(mockRepository.createUserAndQueueUserCreatedEvent).toHaveBeenCalledWith({
        userData: {
          username: 'alice',
          name: 'Alice Example',
          email: 'alice@example.com',
          password: 'hashed-new-password',
          bio: 'Hello',
          profileImage: {
            secureUrl: 'https://cdn.example.com/alice.jpg',
            publicId: 'users/alice',
          },
          gender: 'female',
        },
      });
      expect(result).toEqual(safeUser);
      expect(result).not.toHaveProperty('password');
      expect(mockCache.set).toHaveBeenCalledTimes(2);
      expect(mockCache.set).toHaveBeenNthCalledWith(1, userCacheKeyById('user-1'), safeUser, CACHE_TTL.USER);
      expect(mockCache.set).toHaveBeenNthCalledWith(2, userCacheKeyByUsername('alice'), safeUser, CACHE_TTL.USER);
      expect(userCreatedTotal.inc).toHaveBeenCalledTimes(1);
      expect(userCreatedTotal.inc).toHaveBeenCalledWith({ result: 'success', reason: 'created' });
      expect(stopTimer).toHaveBeenCalledTimes(1);
    });

    it('rejects a taken username before hashing, persistence, or cache writes', async () => {
      // Arrange
      mockRepository.findByEmailOrUsername.mockResolvedValue(
        createUser({ email: 'someone-else@example.com', username: 'alice' }),
      );

      // Act
      const result = userService.createUser(createUserDto());

      // Assert
      await expect(result).rejects.toMatchObject({
        statusCode: 409,
        message: 'Username already taken',
      });
      expect(mockBcryptHash).not.toHaveBeenCalled();
      expect(mockRepository.createUserAndQueueUserCreatedEvent).not.toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
      expect(userCreatedTotal.inc).toHaveBeenCalledWith({ result: 'error', reason: 'username_taken' });
      expect(stopTimer).toHaveBeenCalledTimes(1);
    });

    it('rejects a registered email before hashing, persistence, or cache writes', async () => {
      // Arrange
      mockRepository.findByEmailOrUsername.mockResolvedValue(
        createUser({ email: 'alice@example.com', username: 'different-user' }),
      );

      // Act
      const result = userService.createUser(createUserDto());

      // Assert
      await expect(result).rejects.toMatchObject({
        statusCode: 409,
        message: 'Email already registered',
      });
      expect(mockBcryptHash).not.toHaveBeenCalled();
      expect(mockRepository.createUserAndQueueUserCreatedEvent).not.toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
      expect(userCreatedTotal.inc).toHaveBeenCalledWith({ result: 'error', reason: 'email_registered' });
    });

    it('maps a database uniqueness race to a safe conflict without writing cache', async () => {
      // Arrange
      const uniqueConstraintError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.1.0',
        meta: { target: ['username'] },
      });
      mockRepository.createUserAndQueueUserCreatedEvent.mockRejectedValue(uniqueConstraintError);

      // Act
      const result = userService.createUser(createUserDto());

      // Assert
      await expect(result).rejects.toMatchObject({
        statusCode: 409,
        message: 'Username or email already exists',
      });
      expect(mockCache.set).not.toHaveBeenCalled();
      expect(userCreatedTotal.inc).toHaveBeenCalledTimes(1);
      expect(userCreatedTotal.inc).toHaveBeenCalledWith({
        result: 'error',
        reason: 'duplicate_race_condition',
      });
    });

    it('propagates unexpected persistence failures and never reports creation success', async () => {
      // Arrange
      const databaseError = new Error('database unavailable');
      mockRepository.createUserAndQueueUserCreatedEvent.mockRejectedValue(databaseError);

      // Act
      const result = userService.createUser(createUserDto());

      // Assert
      await expect(result).rejects.toBe(databaseError);
      expect(mockCache.set).not.toHaveBeenCalled();
      expect(userCreatedTotal.inc).toHaveBeenCalledTimes(1);
      expect(userCreatedTotal.inc).toHaveBeenCalledWith({ result: 'error', reason: 'database_error' });
      expect(userCreatedTotal.inc).not.toHaveBeenCalledWith({ result: 'success', reason: 'created' });
      expect(stopTimer).toHaveBeenCalledTimes(1);
    });

    it('returns the persisted user when cache population fails because cache is non-authoritative', async () => {
      // Arrange
      const createdUser = createUser();
      const cacheError = new Error('cache unavailable');
      mockRepository.createUserAndQueueUserCreatedEvent.mockResolvedValue(createdUser);
      mockCache.set.mockRejectedValue(cacheError);

      // Act
      const result = await userService.createUser(createUserDto());

      // Assert
      expect(result).toEqual(toSafeUser(createdUser));
      expect(redisCacheOperationsTotal.inc).toHaveBeenCalledTimes(1);
      expect(redisCacheOperationsTotal.inc).toHaveBeenCalledWith({ operation: 'write', result: 'error' });
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { userId: 'user-1', error: cacheError },
        'User cache write failed',
      );
    });
  });

  describe.each([
    {
      methodName: 'getUserByUsername' as const,
      lookupValue: 'alice',
      cacheKey: userCacheKeyByUsername('alice'),
      lookupType: 'username',
      repositoryMethod: mockRepository.findByUsername,
    },
    {
      methodName: 'getUserById' as const,
      lookupValue: 'user-1',
      cacheKey: userCacheKeyById('user-1'),
      lookupType: 'id',
      repositoryMethod: mockRepository.findUserById,
    },
  ])('$methodName', ({ methodName, lookupValue, cacheKey, lookupType, repositoryMethod }) => {
    it('returns a public cached profile without querying the database or exposing email/password', async () => {
      // Arrange
      const cachedUser = toSafeUser(createUser());
      mockCache.get.mockResolvedValue(cachedUser);

      // Act
      const result = await userService[methodName](lookupValue);

      // Assert
      expect(mockCache.get).toHaveBeenCalledTimes(1);
      expect(mockCache.get).toHaveBeenCalledWith(cacheKey);
      expect(repositoryMethod).not.toHaveBeenCalled();
      expect(result).toEqual({
        id: 'user-1',
        username: 'alice',
        name: 'Alice Example',
        bio: 'Hello',
        profileImage: {
          secureUrl: 'https://cdn.example.com/alice.jpg',
          publicId: 'users/alice',
        },
        gender: 'female',
        status: 'ACTIVE',
        role: 'USER',
        isPrivate: false,
        followersCount: 7,
        followingCount: 3,
        createdAt: new Date('2026-01-10T10:00:00.000Z'),
        updatedAt: new Date('2026-02-20T12:30:00.000Z'),
      });
      expect(result).not.toHaveProperty('email');
      expect(result).not.toHaveProperty('password');
      expect(userProfileReadsTotal.inc).toHaveBeenCalledWith({
        lookup_type: lookupType,
        result: 'cache_hit',
      });
    });

    it('returns only the limited identity fields for a private cached profile', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(toSafeUser(createUser({ isPrivate: true })));

      // Act
      const result = await userService[methodName](lookupValue);

      // Assert
      expect(result).toEqual({
        id: 'user-1',
        username: 'alice',
        name: 'Alice Example',
        profileImage: {
          secureUrl: 'https://cdn.example.com/alice.jpg',
          publicId: 'users/alice',
        },
        isPrivate: true,
      });
      expect(repositoryMethod).not.toHaveBeenCalled();
    });

    it('loads a cache miss from the database, caches the password-free user under both identities, and returns public data', async () => {
      // Arrange
      const databaseUser = createUser();
      const safeUser = toSafeUser(databaseUser);
      repositoryMethod.mockResolvedValue(databaseUser);

      // Act
      const result = await userService[methodName](lookupValue);

      // Assert
      expect(repositoryMethod).toHaveBeenCalledTimes(1);
      expect(repositoryMethod).toHaveBeenCalledWith(lookupValue);
      expect(mockCache.set).toHaveBeenCalledTimes(2);
      expect(mockCache.set).toHaveBeenNthCalledWith(1, userCacheKeyById('user-1'), safeUser, CACHE_TTL.USER);
      expect(mockCache.set).toHaveBeenNthCalledWith(2, userCacheKeyByUsername('alice'), safeUser, CACHE_TTL.USER);
      expect(result).not.toHaveProperty('email');
      expect(result).not.toHaveProperty('password');
      expect(userProfileReadsTotal.inc).toHaveBeenCalledWith({
        lookup_type: lookupType,
        result: 'database_hit',
      });
    });

    it('returns null for an unknown user without writing empty cache entries', async () => {
      // Arrange
      repositoryMethod.mockResolvedValue(null);

      // Act
      const result = await userService[methodName](lookupValue);

      // Assert
      expect(result).toBeNull();
      expect(mockCache.set).not.toHaveBeenCalled();
      expect(userProfileReadsTotal.inc).toHaveBeenCalledWith({
        lookup_type: lookupType,
        result: 'not_found',
      });
      expect(stopTimer).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateUserProfileImage', () => {
    it('updates through the transactional repository, strips password, and refreshes both user caches', async () => {
      // Arrange
      const updatedUser = createUser({
        profileImage: {
          secureUrl: 'https://cdn.example.com/new.jpg',
          publicId: 'users/new',
        },
      });
      const safeUser = toSafeUser(updatedUser);
      mockRepository.updateProfileImageByIdAndQueueUserUpdatedEvent.mockResolvedValue(updatedUser);

      // Act
      const result = await userService.updateUserProfileImage(
        {
          secureUrl: 'https://cdn.example.com/new.jpg',
          publicId: 'users/new',
        },
        'user-1',
      );

      // Assert
      expect(mockRepository.updateProfileImageByIdAndQueueUserUpdatedEvent).toHaveBeenCalledWith(
        'https://cdn.example.com/new.jpg',
        'users/new',
        'user-1',
      );
      expect(result).toEqual(safeUser);
      expect(result).not.toHaveProperty('password');
      expect(mockCache.set).toHaveBeenNthCalledWith(1, userCacheKeyById('user-1'), safeUser, CACHE_TTL.USER);
      expect(mockCache.set).toHaveBeenNthCalledWith(2, userCacheKeyByUsername('alice'), safeUser, CACHE_TTL.USER);
    });

    it('propagates repository failure without writing cache and still closes operation timing', async () => {
      // Arrange
      const repositoryError = new Error('database unavailable');
      mockRepository.updateProfileImageByIdAndQueueUserUpdatedEvent.mockRejectedValue(repositoryError);

      // Act
      const result = userService.updateUserProfileImage(
        {
          secureUrl: 'https://cdn.example.com/new.jpg',
          publicId: 'users/new',
        },
        'user-1',
      );

      // Assert
      await expect(result).rejects.toBe(repositoryError);
      expect(mockCache.set).not.toHaveBeenCalled();
      expect(stopTimer).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateMyProfile', () => {
    it('rejects an unknown authenticated user without checking username availability or updating', async () => {
      // Arrange
      mockRepository.findUserById.mockResolvedValue(null);

      // Act
      const result = userService.updateMyProfile('missing-user', { name: 'New Name' });

      // Assert
      await expect(result).rejects.toMatchObject({ statusCode: 404, message: 'user not found' });
      expect(mockRepository.findByUsername).not.toHaveBeenCalled();
      expect(mockRepository.updateUserAndQueueUserUpdatedEvent).not.toHaveBeenCalled();
      expect(mockCache.deleteMany).not.toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
      expect(stopTimer).toHaveBeenCalledTimes(1);
    });

    it('updates non-username fields without performing an unnecessary uniqueness lookup or deleting identity caches', async () => {
      // Arrange
      const existingUser = createUser();
      const updatedUser = createUser({ name: 'Alice Updated', bio: 'Updated bio' });
      mockRepository.findUserById.mockResolvedValue(existingUser);
      mockRepository.updateUserAndQueueUserUpdatedEvent.mockResolvedValue(updatedUser);

      // Act
      const result = await userService.updateMyProfile('user-1', {
        name: 'Alice Updated',
        bio: 'Updated bio',
      });

      // Assert
      expect(mockRepository.findByUsername).not.toHaveBeenCalled();
      expect(mockRepository.updateUserAndQueueUserUpdatedEvent).toHaveBeenCalledWith('user-1', {
        name: 'Alice Updated',
        bio: 'Updated bio',
      });
      expect(mockCache.deleteMany).not.toHaveBeenCalled();
      expect(result).toEqual(toSafeUser(updatedUser));
    });

    it('does not check availability or invalidate old keys when username is unchanged', async () => {
      // Arrange
      mockRepository.findUserById.mockResolvedValue(createUser());
      mockRepository.updateUserAndQueueUserUpdatedEvent.mockResolvedValue(createUser({ name: 'New Name' }));

      // Act
      await userService.updateMyProfile('user-1', { username: 'alice', name: 'New Name' });

      // Assert
      expect(mockRepository.findByUsername).not.toHaveBeenCalled();
      expect(mockCache.deleteMany).not.toHaveBeenCalled();
      expect(mockRepository.updateUserAndQueueUserUpdatedEvent).toHaveBeenCalledWith('user-1', {
        username: 'alice',
        name: 'New Name',
      });
    });

    it('rejects a username owned by another user before update or cache mutation', async () => {
      // Arrange
      mockRepository.findUserById.mockResolvedValue(createUser());
      mockRepository.findByUsername.mockResolvedValue(createUser({ id: 'user-2', username: 'bob' }));

      // Act
      const result = userService.updateMyProfile('user-1', { username: 'bob' });

      // Assert
      await expect(result).rejects.toMatchObject({ statusCode: 409, message: 'username already taken' });
      expect(mockRepository.findByUsername).toHaveBeenCalledWith('bob');
      expect(mockRepository.updateUserAndQueueUserUpdatedEvent).not.toHaveBeenCalled();
      expect(mockCache.deleteMany).not.toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('invalidates old identity keys after a username update, then caches the updated identity', async () => {
      // Arrange
      const existingUser = createUser();
      const updatedUser = createUser({ username: 'alice-new' });
      const safeUpdatedUser = toSafeUser(updatedUser);
      mockRepository.findUserById.mockResolvedValue(existingUser);
      mockRepository.findByUsername.mockResolvedValue(null);
      mockRepository.updateUserAndQueueUserUpdatedEvent.mockResolvedValue(updatedUser);

      // Act
      const result = await userService.updateMyProfile('user-1', { username: 'alice-new' });

      // Assert
      expect(mockRepository.findByUsername).toHaveBeenCalledWith('alice-new');
      expect(mockRepository.updateUserAndQueueUserUpdatedEvent).toHaveBeenCalledWith('user-1', {
        username: 'alice-new',
      });
      expect(mockCache.deleteMany).toHaveBeenCalledWith([
        userCacheKeyById('user-1'),
        userCacheKeyByUsername('alice'),
      ]);
      expect(mockCache.set).toHaveBeenNthCalledWith(
        1,
        userCacheKeyById('user-1'),
        safeUpdatedUser,
        CACHE_TTL.USER,
      );
      expect(mockCache.set).toHaveBeenNthCalledWith(
        2,
        userCacheKeyByUsername('alice-new'),
        safeUpdatedUser,
        CACHE_TTL.USER,
      );
      expect(mockRepository.updateUserAndQueueUserUpdatedEvent.mock.invocationCallOrder[0]).toBeLessThan(
        mockCache.deleteMany.mock.invocationCallOrder[0],
      );
      expect(mockCache.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
        mockCache.set.mock.invocationCallOrder[0],
      );
      expect(result).toEqual(safeUpdatedUser);
    });
  });

  describe('account status transitions', () => {
    it('rejects an administrative status update for an unknown user', async () => {
      // Arrange
      mockRepository.findUserById.mockResolvedValue(null);

      // Act
      const result = userService.updateUserStatus('missing-user', 'BLOCKED');

      // Assert
      await expect(result).rejects.toMatchObject({ statusCode: 404, message: 'user not found' });
      expect(mockRepository.updateUserStatusAndQueueUserUpdatedEvent).not.toHaveBeenCalled();
      expect(mockCache.deleteMany).not.toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('rejects status changes for a deleted account', async () => {
      // Arrange
      mockRepository.findUserById.mockResolvedValue(createUser({ status: 'DELETED' }));

      // Act
      const result = userService.updateUserStatus('user-1', 'ACTIVE');

      // Assert
      await expect(result).rejects.toMatchObject({
        statusCode: 410,
        message: 'deleted accounts cannot be updated',
      });
      expect(mockRepository.updateUserStatusAndQueueUserUpdatedEvent).not.toHaveBeenCalled();
      expect(mockCache.deleteMany).not.toHaveBeenCalled();
    });

    it('returns the existing safe user without event creation or cache mutation when status is unchanged', async () => {
      // Arrange
      const activeUser = createUser({ status: 'ACTIVE' });
      mockRepository.findUserById.mockResolvedValue(activeUser);

      // Act
      const result = await userService.updateUserStatus('user-1', 'ACTIVE');

      // Assert
      expect(result).toEqual(toSafeUser(activeUser));
      expect(result).not.toHaveProperty('password');
      expect(mockRepository.updateUserStatusAndQueueUserUpdatedEvent).not.toHaveBeenCalled();
      expect(mockCache.deleteMany).not.toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
      expect(stopTimer).toHaveBeenCalledTimes(1);
    });

    it('persists a changed status with its outbox event, invalidates old keys, and caches the updated user', async () => {
      // Arrange
      const existingUser = createUser({ status: 'ACTIVE' });
      const updatedUser = createUser({ status: 'SUSPENDED' });
      const safeUpdatedUser = toSafeUser(updatedUser);
      mockRepository.findUserById.mockResolvedValue(existingUser);
      mockRepository.updateUserStatusAndQueueUserUpdatedEvent.mockResolvedValue(updatedUser);

      // Act
      const result = await userService.updateUserStatus('user-1', 'SUSPENDED');

      // Assert
      expect(mockRepository.updateUserStatusAndQueueUserUpdatedEvent).toHaveBeenCalledWith(
        'user-1',
        'SUSPENDED',
      );
      expect(mockCache.deleteMany).toHaveBeenCalledWith([
        userCacheKeyById('user-1'),
        userCacheKeyByUsername('alice'),
      ]);
      expect(mockCache.set).toHaveBeenNthCalledWith(1, userCacheKeyById('user-1'), safeUpdatedUser, CACHE_TTL.USER);
      expect(mockCache.set).toHaveBeenNthCalledWith(
        2,
        userCacheKeyByUsername('alice'),
        safeUpdatedUser,
        CACHE_TTL.USER,
      );
      expect(mockRepository.updateUserStatusAndQueueUserUpdatedEvent.mock.invocationCallOrder[0]).toBeLessThan(
        mockCache.deleteMany.mock.invocationCallOrder[0],
      );
      expect(result).toEqual(safeUpdatedUser);
    });

    it.each(['BLOCKED', 'SUSPENDED'] as const)(
      'prevents a %s account from self-reactivating without mutating state',
      async (status) => {
        // Arrange
        mockRepository.findUserById.mockResolvedValue(createUser({ status }));

        // Act
        const result = userService.reactivateMyAccount('user-1');

        // Assert
        await expect(result).rejects.toMatchObject({
          statusCode: 403,
          message: 'account cannot be reactivated while blocked or suspended',
        });
        expect(mockRepository.updateUserStatusAndQueueUserUpdatedEvent).not.toHaveBeenCalled();
        expect(mockCache.deleteMany).not.toHaveBeenCalled();
      },
    );

    it('deactivates an active account through the shared status transition', async () => {
      // Arrange
      mockRepository.findUserById.mockResolvedValue(createUser({ status: 'ACTIVE' }));
      mockRepository.updateUserStatusAndQueueUserUpdatedEvent.mockResolvedValue(
        createUser({ status: 'DEACTIVATED' }),
      );

      // Act
      const result = await userService.deactivateMyAccount('user-1');

      // Assert
      expect(mockRepository.updateUserStatusAndQueueUserUpdatedEvent).toHaveBeenCalledWith(
        'user-1',
        'DEACTIVATED',
      );
      expect(result.status).toBe('DEACTIVATED');
    });

    it('does not deactivate an account that no longer exists', async () => {
      // Arrange
      mockRepository.findUserById.mockResolvedValue(null);

      // Act
      const result = userService.deactivateMyAccount('missing-user');

      // Assert
      await expect(result).rejects.toMatchObject({ statusCode: 404, message: 'user not found' });
      expect(mockRepository.updateUserStatusAndQueueUserUpdatedEvent).not.toHaveBeenCalled();
      expect(mockCache.deleteMany).not.toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('reactivates a deactivated account but never a deleted account', async () => {
      // Arrange
      mockRepository.findUserById.mockResolvedValue(createUser({ status: 'DEACTIVATED' }));
      mockRepository.updateUserStatusAndQueueUserUpdatedEvent.mockResolvedValue(createUser({ status: 'ACTIVE' }));

      // Act
      const result = await userService.reactivateMyAccount('user-1');

      // Assert
      expect(mockRepository.updateUserStatusAndQueueUserUpdatedEvent).toHaveBeenCalledWith('user-1', 'ACTIVE');
      expect(result.status).toBe('ACTIVE');
    });

    it('does not delete an account that is already deleted', async () => {
      // Arrange
      mockRepository.findUserById.mockResolvedValue(createUser({ status: 'DELETED' }));

      // Act
      const result = userService.deleteMyAccount('user-1');

      // Assert
      await expect(result).rejects.toMatchObject({ statusCode: 410, message: 'account already deleted' });
      expect(mockRepository.updateUserStatusAndQueueUserUpdatedEvent).not.toHaveBeenCalled();
      expect(mockCache.deleteMany).not.toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('marks an account deleted and does not return private user data', async () => {
      // Arrange
      mockRepository.findUserById.mockResolvedValue(createUser({ status: 'ACTIVE' }));
      mockRepository.updateUserStatusAndQueueUserUpdatedEvent.mockResolvedValue(createUser({ status: 'DELETED' }));

      // Act
      const result = await userService.deleteMyAccount('user-1');

      // Assert
      expect(result).toBeUndefined();
      expect(mockRepository.updateUserStatusAndQueueUserUpdatedEvent).toHaveBeenCalledWith('user-1', 'DELETED');
      expect(mockCache.deleteMany).toHaveBeenCalledWith([
        userCacheKeyById('user-1'),
        userCacheKeyByUsername('alice'),
      ]);
    });
  });

  describe.each([
    {
      methodName: 'followCreated' as const,
      repositoryMethod: mockRepository.applyFollowCreatedEvent,
      operation: 'follow_created_projection',
    },
    {
      methodName: 'followRemoved' as const,
      repositoryMethod: mockRepository.applyFollowRemovedEvent,
      operation: 'follow_removed_projection',
    },
  ])('$methodName', ({ methodName, repositoryMethod, operation }) => {
    const event = {
      eventId: 'event-123',
      followerId: 'follower-1',
      followeeId: 'followee-1',
    };

    it('does nothing after the repository identifies a duplicate event', async () => {
      // Arrange
      repositoryMethod.mockResolvedValue(false);

      // Act
      await userService[methodName](event);

      // Assert
      expect(repositoryMethod).toHaveBeenCalledTimes(1);
      expect(repositoryMethod).toHaveBeenCalledWith(event);
      expect(mockRepository.findUserById).not.toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
      expect(userServiceOperationDurationSeconds.startTimer).toHaveBeenCalledWith({ operation });
      expect(stopTimer).toHaveBeenCalledTimes(1);
    });

    it('refreshes both affected users with exact password-free cache entries after applying the event', async () => {
      // Arrange
      const follower = createUser({
        id: 'follower-1',
        username: 'follower',
        email: 'follower@example.com',
        followingCount: methodName === 'followCreated' ? 4 : 2,
      });
      const followee = createUser({
        id: 'followee-1',
        username: 'followee',
        email: 'followee@example.com',
        followersCount: methodName === 'followCreated' ? 8 : 6,
      });
      mockRepository.findUserById.mockImplementation(async (userId) => {
        if (userId === 'follower-1') return follower;
        if (userId === 'followee-1') return followee;
        return null;
      });

      // Act
      await userService[methodName](event);

      // Assert
      expect(mockRepository.findUserById).toHaveBeenCalledTimes(2);
      expect(mockRepository.findUserById).toHaveBeenCalledWith('follower-1');
      expect(mockRepository.findUserById).toHaveBeenCalledWith('followee-1');
      expect(mockCache.set).toHaveBeenCalledTimes(4);
      expect(mockCache.set).toHaveBeenCalledWith(
        userCacheKeyById('follower-1'),
        toSafeUser(follower),
        CACHE_TTL.USER,
      );
      expect(mockCache.set).toHaveBeenCalledWith(
        userCacheKeyByUsername('follower'),
        toSafeUser(follower),
        CACHE_TTL.USER,
      );
      expect(mockCache.set).toHaveBeenCalledWith(
        userCacheKeyById('followee-1'),
        toSafeUser(followee),
        CACHE_TTL.USER,
      );
      expect(mockCache.set).toHaveBeenCalledWith(
        userCacheKeyByUsername('followee'),
        toSafeUser(followee),
        CACHE_TTL.USER,
      );
    });

    it('does not fail event processing when cache refresh fails after the projection was committed', async () => {
      // Arrange
      const cacheError = new Error('cache unavailable');
      mockRepository.findUserById.mockResolvedValue(createUser());
      mockCache.set.mockRejectedValue(cacheError);

      // Act
      await expect(userService[methodName](event)).resolves.toBeUndefined();

      // Assert
      expect(redisCacheOperationsTotal.inc).toHaveBeenCalledTimes(1);
      expect(redisCacheOperationsTotal.inc).toHaveBeenCalledWith({ operation: 'refresh', result: 'error' });
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        {
          error: cacheError,
          followerId: 'follower-1',
          followeeId: 'followee-1',
        },
        'User cache refresh failed',
      );
      expect(stopTimer).toHaveBeenCalledTimes(1);
    });

    it('does not recreate cache entries when both projected users no longer exist', async () => {
      // Arrange
      mockRepository.findUserById.mockResolvedValue(null);

      // Act
      await userService[methodName](event);

      // Assert
      expect(mockRepository.findUserById).toHaveBeenCalledTimes(2);
      expect(mockRepository.findUserById).toHaveBeenCalledWith('follower-1');
      expect(mockRepository.findUserById).toHaveBeenCalledWith('followee-1');
      expect(mockCache.set).not.toHaveBeenCalled();
      expect(redisCacheOperationsTotal.inc).not.toHaveBeenCalledWith({
        operation: 'refresh',
        result: 'error',
      });
    });

    it('propagates projection persistence failures without attempting cache refresh', async () => {
      // Arrange
      const repositoryError = new Error('projection transaction failed');
      repositoryMethod.mockRejectedValue(repositoryError);

      // Act
      const result = userService[methodName](event);

      // Assert
      await expect(result).rejects.toBe(repositoryError);
      expect(mockRepository.findUserById).not.toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
      expect(stopTimer).toHaveBeenCalledTimes(1);
    });
  });
});
