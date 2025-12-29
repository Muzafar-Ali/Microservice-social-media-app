// src/repositories/user.repository.ts
import { PrismaClient, User, Prisma } from '../../generated/prisma/client.js';
import { UpdateMyProfileDto } from './user.schema.js';


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

  findById = async (id: number): Promise<User | null> => {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByUsername = async(username: string): Promise<User | null> => {
    return this.prisma.user.findUnique({ where: { username } });
  }

  updateUser = async (id: number, data: UpdateMyProfileDto): Promise<User> => {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  updateProfileImageById = async (secureUrl: string, publicId: string, userId: number) => {
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

}
