// src/repositories/user.repository.ts
import { PrismaClient, User, Prisma } from '../../generated/prisma/client.js';
import { UpdateMyProfileDto } from './user.validations.js';


export class UserRepository {
  private prisma: PrismaClient;

  constructor(prismaClient: PrismaClient) {
    this.prisma = prismaClient;
  }

  createUser = async (data: Prisma.UserCreateInput): Promise<User> => {
    return this.prisma.user.create({ data });
  }

  findByEmailOrUsername = async (email: string, username: string): Promise<User | null> => {
    return this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });
  }

  findUserById = async (userId: string): Promise<User | null> => {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  findByUsername = async(username: string): Promise<User | null> => {
    return this.prisma.user.findUnique({ where: { username } });
  }

  updateUser = async (userId: string, data: UpdateMyProfileDto): Promise<User> => {
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }
  
  updateProfileImageById = async (secureUrl: string, publicId: string, userId: string) => {
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

  incrementFollowersCount = async (userId: string, delta: number) => {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        followersCount: {
          increment: delta,
        },
      },
    });
  };

  incrementFollowingCount = async (userId: string, delta: number) => {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        followingCount: {
          increment: delta,
        },
      },
    });
  };

}
