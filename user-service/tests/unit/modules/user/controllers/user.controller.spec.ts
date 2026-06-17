import { jest } from '@jest/globals';
import { NextFunction, Request, Response } from 'express';

jest.mock('../../../../../src/modules/user/user.service.js', () => ({
  UserService: class UserService {},
}));

jest.mock('../../../../../src/monitoring/user.metrics.js', () => ({
  userCreatedTotal: { inc: jest.fn() },
  userUpdatedTotal: { inc: jest.fn() },
}));

import { userUpdatedTotal } from '../../../../../src/monitoring/user.metrics.js';
import { UserController } from '../../../../../src/modules/user/user.controllers.js';

const mockUserUpdatedInc = jest.mocked(userUpdatedTotal.inc);

type UserProfile = {
  id: string;
  username: string;
  name: string;
  email?: string;
  bio: string | null;
  status: 'ACTIVE' | 'BLOCKED' | 'SUSPENDED' | 'DEACTIVATED' | 'DELETED';
  isPrivate: boolean;
};

type RequestOverrides<TRequest extends Request> = Partial<TRequest> & {
  body?: unknown;
  params?: unknown;
  userId?: string;
};

const request = <TRequest extends Request>(overrides: RequestOverrides<TRequest> = {}): TRequest =>
  ({
    body: {},
    params: {},
    headers: {},
    ...overrides,
  }) as unknown as TRequest;

const profile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: '11111111-1111-4111-8111-111111111111',
  username: 'alice',
  name: 'Alice Example',
  email: 'alice@example.com',
  bio: 'Hello',
  status: 'ACTIVE',
  isPrivate: false,
  ...overrides,
});

describe('UserController', () => {
  const service = {
    createUser: jest.fn<(dto: object) => Promise<UserProfile>>(),
    getUserById: jest.fn<(userId: string) => Promise<UserProfile | null>>(),
    getUserByUsername: jest.fn<(username: string) => Promise<UserProfile | null>>(),
    updateUserProfileImage: jest.fn<(dto: object, userId: string) => Promise<UserProfile | null>>(),
    updateMyProfile: jest.fn<(userId: string, dto: object) => Promise<UserProfile>>(),
    updateUserStatus: jest.fn<(userId: string, status: string) => Promise<UserProfile>>(),
    deactivateMyAccount: jest.fn<(userId: string) => Promise<UserProfile>>(),
    reactivateMyAccount: jest.fn<(userId: string) => Promise<UserProfile>>(),
    deleteMyAccount: jest.fn<(userId: string) => Promise<void>>(),
  };

  let controller: UserController;
  let res: Response;
  let next: jest.Mock;
  let status: jest.Mock;
  let json: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    service.createUser.mockResolvedValue(profile());
    service.getUserById.mockResolvedValue(profile());
    service.getUserByUsername.mockResolvedValue(profile());
    service.updateUserProfileImage.mockResolvedValue(profile());
    service.updateMyProfile.mockResolvedValue(profile());
    service.updateUserStatus.mockResolvedValue(profile());
    service.deactivateMyAccount.mockResolvedValue(profile({ status: 'DEACTIVATED' }));
    service.reactivateMyAccount.mockResolvedValue(profile({ status: 'ACTIVE' }));
    service.deleteMyAccount.mockResolvedValue(undefined);

    controller = new UserController(service as never);
    json = jest.fn();
    status = jest.fn(() => ({ json }));
    res = { status, json } as unknown as Response;
    next = jest.fn();
  });

  const expectNoResponse = () => {
    expect(status).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
  };

  describe('createUser', () => {
    it('passes the validated registration payload and returns the created safe user', async () => {
      // Arrange
      const dto = {
        username: 'alice',
        name: 'Alice Example',
        email: 'alice@example.com',
        password: 'Password123!',
        gender: 'female' as const,
      };
      const createdUser = profile();
      const req = request<Parameters<UserController['createUser']>[0]>({ body: dto });
      service.createUser.mockResolvedValue(createdUser);

      // Act
      await controller.createUser(req, res, next as unknown as NextFunction);

      // Assert
      expect(service.createUser).toHaveBeenCalledTimes(1);
      expect(service.createUser).toHaveBeenCalledWith(dto);
      expect(status).toHaveBeenCalledTimes(1);
      expect(status).toHaveBeenCalledWith(201);
      expect(json).toHaveBeenCalledTimes(1);
      expect(json).toHaveBeenCalledWith({
        success: true,
        message: 'user created successfully',
        data: createdUser,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('forwards service failure without sending a success response', async () => {
      // Arrange
      const error = new Error('username already taken');
      const req = request<Parameters<UserController['createUser']>[0]>({
        body: {
          username: 'alice',
          name: 'Alice',
          email: 'alice@example.com',
          password: 'Password123!',
        },
      });
      service.createUser.mockRejectedValue(error);

      // Act
      await controller.createUser(req, res, next as unknown as NextFunction);

      // Assert
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(error);
      expectNoResponse();
    });
  });

  describe('getProfileById', () => {
    const userId = '11111111-1111-4111-8111-111111111111';

    it('returns the exact profile for a valid id', async () => {
      // Arrange
      const foundProfile = profile();
      const req = request<Parameters<UserController['getProfileById']>[0]>({ params: { id: userId } });
      service.getUserById.mockResolvedValue(foundProfile);

      // Act
      await controller.getProfileById(req, res, next as unknown as NextFunction);

      // Assert
      expect(service.getUserById).toHaveBeenCalledWith(userId);
      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith({ success: true, data: foundProfile });
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects an invalid id without querying the service', async () => {
      // Arrange
      const req = request<Parameters<UserController['getProfileById']>[0]>({
        params: { id: 'not-a-uuid' },
      });

      // Act
      await controller.getProfileById(req, res, next as unknown as NextFunction);

      // Assert
      expect(service.getUserById).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400, message: 'id: User ID is required' }),
      );
      expectNoResponse();
    });

    it('returns 404 when the profile does not exist', async () => {
      // Arrange
      const req = request<Parameters<UserController['getProfileById']>[0]>({ params: { id: userId } });
      service.getUserById.mockResolvedValue(null);

      // Act
      await controller.getProfileById(req, res, next as unknown as NextFunction);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404, message: 'user not found' }));
      expectNoResponse();
    });

    it('forwards lookup failure without sending a response', async () => {
      // Arrange
      const error = new Error('database unavailable');
      const req = request<Parameters<UserController['getProfileById']>[0]>({ params: { id: userId } });
      service.getUserById.mockRejectedValue(error);

      // Act
      await controller.getProfileById(req, res, next as unknown as NextFunction);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expectNoResponse();
    });
  });

  describe('getProfileByUsername', () => {
    it('normalizes the username before lookup and returns the profile', async () => {
      // Arrange
      const foundProfile = profile();
      const req = request<Parameters<UserController['getProfileByUsername']>[0]>({
        params: { username: '  ALICE  ' },
      });
      service.getUserByUsername.mockResolvedValue(foundProfile);

      // Act
      await controller.getProfileByUsername(req, res, next as unknown as NextFunction);

      // Assert
      expect(service.getUserByUsername).toHaveBeenCalledWith('alice');
      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith({ success: true, data: foundProfile });
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects a blank username without querying the service', async () => {
      // Arrange
      const req = request<Parameters<UserController['getProfileByUsername']>[0]>({
        params: { username: '   ' },
      });

      // Act
      await controller.getProfileByUsername(req, res, next as unknown as NextFunction);

      // Assert
      expect(service.getUserByUsername).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
      expectNoResponse();
    });

    it('returns 404 when the username has no profile', async () => {
      // Arrange
      const req = request<Parameters<UserController['getProfileByUsername']>[0]>({
        params: { username: 'missing-user' },
      });
      service.getUserByUsername.mockResolvedValue(null);

      // Act
      await controller.getProfileByUsername(req, res, next as unknown as NextFunction);

      // Assert
      expect(service.getUserByUsername).toHaveBeenCalledWith('missing-user');
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404, message: 'user not found' }));
      expectNoResponse();
    });

    it('forwards lookup failure without sending a response', async () => {
      // Arrange
      const error = new Error('database unavailable');
      const req = request<Parameters<UserController['getProfileByUsername']>[0]>({
        params: { username: 'alice' },
      });
      service.getUserByUsername.mockRejectedValue(error);

      // Act
      await controller.getProfileByUsername(req, res, next as unknown as NextFunction);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expectNoResponse();
    });
  });

  describe('updateProfileImage', () => {
    const dto = {
      secureUrl: 'https://cdn.example.com/new.jpg',
      publicId: 'users/new-image',
    };

    it('updates the authenticated user and records success only after the service succeeds', async () => {
      // Arrange
      const req = request<Parameters<UserController['updateProfileImage']>[0]>({
        userId: 'user-1',
        body: dto,
      });

      // Act
      await controller.updateProfileImage(req, res, next as unknown as NextFunction);

      // Assert
      expect(service.updateUserProfileImage).toHaveBeenCalledWith(dto, 'user-1');
      expect(userUpdatedTotal.inc).toHaveBeenCalledTimes(1);
      expect(userUpdatedTotal.inc).toHaveBeenCalledWith({ update_type: 'profile_image' });
      expect(service.updateUserProfileImage.mock.invocationCallOrder[0]).toBeLessThan(
        mockUserUpdatedInc.mock.invocationCallOrder[0],
      );
      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith({
        success: true,
        message: 'Profile image updated successfully',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects an unauthenticated update without calling service or metric', async () => {
      // Arrange
      const req = request<Parameters<UserController['updateProfileImage']>[0]>({ body: dto });

      // Act
      await controller.updateProfileImage(req, res, next as unknown as NextFunction);

      // Assert
      expect(service.updateUserProfileImage).not.toHaveBeenCalled();
      expect(userUpdatedTotal.inc).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401, message: 'Unauthorized' }));
      expectNoResponse();
    });

    it('does not record success or respond when the service fails', async () => {
      // Arrange
      const error = new Error('image update failed');
      const req = request<Parameters<UserController['updateProfileImage']>[0]>({
        userId: 'user-1',
        body: dto,
      });
      service.updateUserProfileImage.mockRejectedValue(error);

      // Act
      await controller.updateProfileImage(req, res, next as unknown as NextFunction);

      // Assert
      expect(userUpdatedTotal.inc).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(error);
      expectNoResponse();
    });
  });

  describe('updateMyProfile', () => {
    it('updates only the authenticated user and returns the exact updated profile', async () => {
      // Arrange
      const dto = { name: 'Alice Updated', isPrivate: true };
      const updatedProfile = profile({ name: 'Alice Updated', isPrivate: true });
      const req = request<Parameters<UserController['updateMyProfile']>[0]>({
        userId: 'user-1',
        body: dto,
      });
      service.updateMyProfile.mockResolvedValue(updatedProfile);

      // Act
      await controller.updateMyProfile(req, res, next as unknown as NextFunction);

      // Assert
      expect(service.updateMyProfile).toHaveBeenCalledWith('user-1', dto);
      expect(userUpdatedTotal.inc).toHaveBeenCalledWith({ update_type: 'profile' });
      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith({
        success: true,
        message: 'Profile updated successfully',
        data: updatedProfile,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects an unauthenticated update without service or metric side effects', async () => {
      // Arrange
      const req = request<Parameters<UserController['updateMyProfile']>[0]>({
        body: { name: 'Alice Updated' },
      });

      // Act
      await controller.updateMyProfile(req, res, next as unknown as NextFunction);

      // Assert
      expect(service.updateMyProfile).not.toHaveBeenCalled();
      expect(userUpdatedTotal.inc).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401, message: 'Unauthorized' }));
      expectNoResponse();
    });

    it('does not record success or respond when the service fails', async () => {
      // Arrange
      const error = new Error('profile update failed');
      const req = request<Parameters<UserController['updateMyProfile']>[0]>({
        userId: 'user-1',
        body: { name: 'Alice Updated' },
      });
      service.updateMyProfile.mockRejectedValue(error);

      // Act
      await controller.updateMyProfile(req, res, next as unknown as NextFunction);

      // Assert
      expect(userUpdatedTotal.inc).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(error);
      expectNoResponse();
    });
  });

  describe('updateUserStatus', () => {
    const userId = '11111111-1111-4111-8111-111111111111';

    it('updates the validated target status and returns the updated user', async () => {
      // Arrange
      const updatedUser = profile({ status: 'SUSPENDED' });
      const req = request<Parameters<UserController['updateUserStatus']>[0]>({
        params: { id: userId },
        body: { status: 'SUSPENDED' },
      });
      service.updateUserStatus.mockResolvedValue(updatedUser);

      // Act
      await controller.updateUserStatus(req, res, next as unknown as NextFunction);

      // Assert
      expect(service.updateUserStatus).toHaveBeenCalledWith(userId, 'SUSPENDED');
      expect(userUpdatedTotal.inc).toHaveBeenCalledWith({ update_type: 'status' });
      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith({
        success: true,
        message: 'User status updated successfully',
        data: updatedUser,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects an invalid target id without changing status or metrics', async () => {
      // Arrange
      const req = request<Parameters<UserController['updateUserStatus']>[0]>({
        params: { id: 'invalid-id' },
        body: { status: 'BLOCKED' },
      });

      // Act
      await controller.updateUserStatus(req, res, next as unknown as NextFunction);

      // Assert
      expect(service.updateUserStatus).not.toHaveBeenCalled();
      expect(userUpdatedTotal.inc).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
      expectNoResponse();
    });

    it('does not record success or respond when the service fails', async () => {
      // Arrange
      const error = new Error('status update failed');
      const req = request<Parameters<UserController['updateUserStatus']>[0]>({
        params: { id: userId },
        body: { status: 'BLOCKED' },
      });
      service.updateUserStatus.mockRejectedValue(error);

      // Act
      await controller.updateUserStatus(req, res, next as unknown as NextFunction);

      // Assert
      expect(userUpdatedTotal.inc).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(error);
      expectNoResponse();
    });
  });

  describe.each([
    {
      method: 'deactivateMyAccount' as const,
      serviceMethod: service.deactivateMyAccount,
      statusValue: 'DEACTIVATED' as const,
      message: 'Account deactivated successfully',
    },
    {
      method: 'reactivateMyAccount' as const,
      serviceMethod: service.reactivateMyAccount,
      statusValue: 'ACTIVE' as const,
      message: 'Account reactivated successfully',
    },
  ])('$method', ({ method, serviceMethod, statusValue, message }) => {
    it('changes the authenticated account status and returns the updated user', async () => {
      // Arrange
      const updatedUser = profile({ status: statusValue });
      const req = request<Request>({ userId: 'user-1' });
      serviceMethod.mockResolvedValue(updatedUser);

      // Act
      await controller[method](req, res, next as unknown as NextFunction);

      // Assert
      expect(serviceMethod).toHaveBeenCalledTimes(1);
      expect(serviceMethod).toHaveBeenCalledWith('user-1');
      expect(userUpdatedTotal.inc).toHaveBeenCalledWith({ update_type: 'status' });
      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith({ success: true, message, data: updatedUser });
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects an unauthenticated status change without side effects', async () => {
      // Arrange
      const req = request<Request>();

      // Act
      await controller[method](req, res, next as unknown as NextFunction);

      // Assert
      expect(serviceMethod).not.toHaveBeenCalled();
      expect(userUpdatedTotal.inc).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401, message: 'Unauthorized' }));
      expectNoResponse();
    });

    it('does not record success or respond when the transition fails', async () => {
      // Arrange
      const error = new Error('account transition failed');
      const req = request<Request>({ userId: 'user-1' });
      serviceMethod.mockRejectedValue(error);

      // Act
      await controller[method](req, res, next as unknown as NextFunction);

      // Assert
      expect(userUpdatedTotal.inc).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(error);
      expectNoResponse();
    });
  });

  describe('deleteMyAccount', () => {
    it('deletes only the authenticated account and returns no user data', async () => {
      // Arrange
      const req = request<Request>({ userId: 'user-1' });

      // Act
      await controller.deleteMyAccount(req, res, next as unknown as NextFunction);

      // Assert
      expect(service.deleteMyAccount).toHaveBeenCalledTimes(1);
      expect(service.deleteMyAccount).toHaveBeenCalledWith('user-1');
      expect(userUpdatedTotal.inc).toHaveBeenCalledWith({ update_type: 'status' });
      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith({
        success: true,
        message: 'Account deleted successfully',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects an unauthenticated deletion without side effects', async () => {
      // Arrange
      const req = request<Request>();

      // Act
      await controller.deleteMyAccount(req, res, next as unknown as NextFunction);

      // Assert
      expect(service.deleteMyAccount).not.toHaveBeenCalled();
      expect(userUpdatedTotal.inc).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401, message: 'Unauthorized' }));
      expectNoResponse();
    });

    it('does not record success or respond when deletion fails', async () => {
      // Arrange
      const error = new Error('account deletion failed');
      const req = request<Request>({ userId: 'user-1' });
      service.deleteMyAccount.mockRejectedValue(error);

      // Act
      await controller.deleteMyAccount(req, res, next as unknown as NextFunction);

      // Assert
      expect(userUpdatedTotal.inc).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(error);
      expectNoResponse();
    });
  });
});
