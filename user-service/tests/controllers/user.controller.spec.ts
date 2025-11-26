import { UserController } from '../../src/controllers/user.controllers';
import { UserService } from '../../src/services/user.service';
import { Request, Response, NextFunction } from 'express';

// Mock UserService
const mockUserService = {
  createUser: jest.fn(),
  getUserById: jest.fn(),
  getUserByUsername: jest.fn(),
};

// Mock Express objects
const mockRequest = <TParams>(body: any, params: TParams): Request<TParams> => {
  const req = {} as Request<TParams>;
  req.body = body;
  req.params = params;
  return req;
};

const mockResponse = (): Response => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext: NextFunction = jest.fn();

describe('UserController', () => {
  let userController: UserController;
  let req: Request<any>;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    userController = new UserController(mockUserService as any);
    res = mockResponse();
    next = mockNext;
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('should create a user and return 201', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123',
        username: 'testuser'
      };
      req = mockRequest(userData, {});
      const createdUser = { id: 1, ...userData };
      
      mockUserService.createUser.mockResolvedValue(createdUser);

      await userController.createUser(req, res, next);

      expect(mockUserService.createUser).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'Test User',
        username: 'testuser',
        isActive: true,
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'user created successfully',
        data: createdUser,
      });
    });

    it('should call next with an error if user creation fails', async () => {
        const userData = {
            email: 'test@example.com',
            name: 'Test User',
            password: 'password123',
            username: 'testuser'
        };
        req = mockRequest(userData, {});
        const error = new Error('User creation failed');
        mockUserService.createUser.mockRejectedValue(error);

        await userController.createUser(req, res, next);

        expect(next).toHaveBeenCalledWith(error);
    });

    it('should call next with a 400 error for invalid input', async () => {
        const invalidUserData = {
            email: 'invalid-email',
            name: 'Test User',
            password: 'password123',
            username: 'testuser'
        };
        req = mockRequest(invalidUserData, {});

        await userController.createUser(req, res, next);

        expect(next).toHaveBeenCalled();
    });
  });

  describe('getProfileById', () => {
    it('should get a user by id and return 200', async () => {
        const userId = 1;
        req = mockRequest({}, { id: String(userId) });
        const userProfile = { id: userId, name: 'Test User', email: 'test@example.com' };

        mockUserService.getUserById.mockResolvedValue(userProfile);

        await userController.getProfileById(req as any, res, next);

        expect(mockUserService.getUserById).toHaveBeenCalledWith(userId);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: userProfile,
        });
    });

    it('should call next with a 404 error if user not found', async () => {
        const userId = 1;
        req = mockRequest({}, { id: String(userId) });

        mockUserService.getUserById.mockResolvedValue(null);

        await userController.getProfileById(req as any, res, next);

        expect(next).toHaveBeenCalled();
    });

    it('should call next with a 400 error for invalid id', async () => {
        req = mockRequest({}, { id: 'invalid-id' });

        await userController.getProfileById(req as any, res, next);

        expect(next).toHaveBeenCalled();
    });
  });

  describe('getProfileByUsername', () => {
    it('should get a user by username and return 200', async () => {
        const username = 'testuser';
        req = mockRequest({}, { username });
        const userProfile = { id: 1, name: 'Test User', email: 'test@example.com', username: username };

        mockUserService.getUserByUsername.mockResolvedValue(userProfile);

        await userController.getProfileByUsername(req as any, res, next);

        expect(mockUserService.getUserByUsername).toHaveBeenCalledWith(username);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: userProfile,
        });
    });

    it('should call next with a 404 error if user not found', async () => {
        const username = 'nonexistentuser';
        req = mockRequest({}, { username });

        mockUserService.getUserByUsername.mockResolvedValue(null);

        await userController.getProfileByUsername(req as any, res, next);

        expect(next).toHaveBeenCalled();
    });

    it('should call next with a 400 error for invalid username', async () => {
        req = mockRequest({}, { username: ' ' });

        await userController.getProfileByUsername(req as any, res, next);

        expect(next).toHaveBeenCalled();
    });
  });
});
