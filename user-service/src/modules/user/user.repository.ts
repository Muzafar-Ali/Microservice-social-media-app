// src/repositories/user.repository.ts
import config from '../../config/config.js';
import { USER_EVENT_NAMES } from '../../events/topics.js';
import { PrismaClient, User, Prisma } from '../../generated/prisma/client.js';
import { UserCreatedPayload } from '../../types/publisher.types.js';
import { UpdateMyProfileDto } from './user.validations.js';

export class UserRepository {
  private prisma: PrismaClient;
  private readonly producerServiceName = config.serviceName;

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

  async createUserAndQueueUserCreatedEvent(data: { userData: Prisma.UserCreateInput }): Promise<User> {
    return this.prisma.$transaction(async (transactionClient: Prisma.TransactionClient) => {
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
          eventId: crypto.randomUUID(),
          eventName: USER_EVENT_NAMES.USER_CREATED,
          eventVersion: 1,
          aggregateId: createdUser.id,
          partitionKey: createdUser.id,
          payload: userCreatedPayload,
          producerService: this.producerServiceName,
          occurredAt: new Date(),
          status: 'PENDING',
        },
      });

      return createdUser;
    });
  }

  updateProfileImageByIdAndQueueUserUpdatedEvent = async (
    secureUrl: string,
    publicId: string,
    userId: string,
  ): Promise<User> => {
    return this.prisma.$transaction(async (transactionClient: Prisma.TransactionClient) => {
      const updatedUser = await transactionClient.user.update({
        where: { id: userId },
        data: {
          profileImage: {
            secureUrl,
            publicId,
          },
        },
      });

      await transactionClient.outboxEvent.create({
        data: {
          eventId: crypto.randomUUID(),
          eventName: USER_EVENT_NAMES.USER_UPDATED,
          eventVersion: 1,
          aggregateId: updatedUser.id,
          partitionKey: updatedUser.id,
          payload: {
            userId: updatedUser.id,
            username: updatedUser.username,
            displayName: updatedUser.name,
            avatarUrl: updatedUser.profileImage,
            status: updatedUser.status,
            updatedAt: updatedUser.updatedAt.toISOString(),
          },
          producerService: this.producerServiceName,
          occurredAt: new Date(),
          status: 'PENDING',
        },
      });

      return updatedUser;
    });
  };

  updateUserAndQueueUserUpdatedEvent = async (userId: string, data: UpdateMyProfileDto): Promise<User> => {
    return this.prisma.$transaction(async (transactionClient: Prisma.TransactionClient) => {
      const updatedUser = await transactionClient.user.update({
        where: { id: userId },
        data,
      });

      await transactionClient.outboxEvent.create({
        data: {
          eventId: crypto.randomUUID(),
          eventName: USER_EVENT_NAMES.USER_UPDATED,
          eventVersion: 1,
          aggregateId: updatedUser.id,
          partitionKey: updatedUser.id,
          payload: {
            userId: updatedUser.id,
            username: updatedUser.username,
            displayName: updatedUser.name,
            avatarUrl: updatedUser.profileImage,
            status: updatedUser.status,
            updatedAt: updatedUser.updatedAt.toISOString(),
          },
          producerService: this.producerServiceName,
          occurredAt: new Date(),
          status: 'PENDING',
        },
      });

      return updatedUser;
    });
  };

  applyFollowCreatedEvent = async (input: {
    eventId: string;
    followerId: string;
    followeeId: string;
  }): Promise<boolean> => {
    try {
      await this.prisma.$transaction(async (transactionClient: Prisma.TransactionClient) => {
        await transactionClient.processedEvent.create({
          data: {
            eventId: input.eventId,
            consumerName: 'user-service:follow-count-projection',
          },
        });

        await transactionClient.user.update({
          where: { id: input.followerId },
          data: {
            followingCount: {
              increment: 1,
            },
          },
        });

        await transactionClient.user.update({
          where: { id: input.followeeId },
          data: {
            followersCount: {
              increment: 1,
            },
          },
        });
      });

      return true;
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        return false;
      }

      throw error;
    }
  };

  async applyFollowRemovedEvent(input: { eventId: string; followerId: string; followeeId: string }): Promise<boolean> {
    try {
      await this.prisma.$transaction(async (transactionClient: Prisma.TransactionClient) => {
        await transactionClient.processedEvent.create({
          data: {
            eventId: input.eventId,
            consumerName: 'user-service:follow-count-projection',
          },
        });

        await transactionClient.user.updateMany({
          where: {
            id: input.followerId,
            followingCount: {
              gt: 0,
            },
          },
          data: {
            followingCount: {
              decrement: 1,
            },
          },
        });

        await transactionClient.user.updateMany({
          where: {
            id: input.followeeId,
            followersCount: {
              gt: 0,
            },
          },
          data: {
            followersCount: {
              decrement: 1,
            },
          },
        });
      });

      return true;
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        return false;
      }

      throw error;
    }
  }

  // Helper methods
  private isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
