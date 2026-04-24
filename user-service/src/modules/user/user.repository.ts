// src/repositories/user.repository.ts
import { USER_EVENT_NAMES } from '../../events/topics.js';
import { PrismaClient, User, Prisma } from '../../generated/prisma/client.js';
import { UserCreatedPayload } from '../../types/publisher.types.js';
import { UpdateMyProfileDto } from './user.validations.js';

export class UserRepository {
  private prisma: PrismaClient;

  constructor(prismaClient: PrismaClient) {
    this.prisma = prismaClient;
  }

  createUser = async (data: Prisma.UserCreateInput): Promise<User> => {
    return this.prisma.user.create({ data });
  };

  findByEmailOrUsername = async (email: string, username: string): Promise<User | null> => {
    return this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });
  };

  findUserById = async (userId: string): Promise<User | null> => {
    return this.prisma.user.findUnique({ where: { id: userId } });
  };

  findByUsername = async (username: string): Promise<User | null> => {
    return this.prisma.user.findUnique({ where: { username } });
  };

  updateUser = async (userId: string, data: UpdateMyProfileDto): Promise<User> => {
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  };

  updateProfileImageById = async (secureUrl: string, publicId: string, userId: string): Promise<User> => {
    return this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        profileImage: {
          secureUrl,
          publicId,
        },
      },
    });
  };

  incrementFollowersCount = async (userId: string, delta: number): Promise<User> => {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        followersCount: {
          increment: delta,
        },
      },
    });
  };

  incrementFollowingCount = async (userId: string, delta: number): Promise<User> => {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        followingCount: {
          increment: delta,
        },
      },
    });
  };

  async createUserAndQueueUserCreatedEvent(data: { userData: Prisma.UserCreateInput }): Promise<User> {
    return this.prisma.$transaction(async (transactionClient: any) => {
      const createdUser = await transactionClient.user.create({
        data: data.userData,
      });

      const userCreatedPayload: UserCreatedPayload = {
        userId: createdUser.id,
        username: createdUser.username,
        displayName: createdUser.name,
        profileImage: createdUser.profileImage as {
          secureUrl: string;
          publicId: string;
        } | null,
        status: createdUser.status,
        createdAt: createdUser.createdAt.toISOString(),
        updatedAt: createdUser.updatedAt.toISOString(),
      };

      await transactionClient.outboxEvent.create({
        data: {
          eventName: USER_EVENT_NAMES.USER_CREATED,
          eventVersion: 1,
          aggregateId: createdUser.id,
          partitionKey: createdUser.id,
          payload: userCreatedPayload,
          status: 'PENDING',
        },
      });

      return createdUser;
    });
  }
}
