// src/repositories/user.repository.ts
import { PrismaClient, User, Prisma } from '../generated/prisma/client.js';

// export interface ListUsersResult {
//   users: User[];
//   total: number;
// }

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

  updateUser = async (id: number, data: Prisma.UserUpdateInput): Promise<User> => {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  deactivateUser = async (id: number): Promise<User> => {
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
