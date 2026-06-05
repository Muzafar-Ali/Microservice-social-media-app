import { PrismaClient } from '../../generated/prisma/client.js';

export class AuthRepository {
  constructor(private prisma: PrismaClient) {}

  getUserByEmailOrUsername = async (email?: string, username?: string) => {
    const orConditions: { email?: string; username?: string }[] = [];

    if (email) {
      orConditions.push({ email });
    }

    if (username) {
      orConditions.push({ username });
    }

    if (orConditions.length === 0) {
      return null; // no identifier given
    }

    const user = await this.prisma.user.findFirst({
      where: { OR: orConditions },
    });

    return user;
  };

  findUserByEmail = async (email: string) => {
    return this.prisma.user.findUnique({
      where: { email },
    });
  };

  findUserById = async (userId: string) => {
    return this.prisma.user.findUnique({
      where: { id: userId },
    });
  };

  updatePasswordById = async (userId: string, hashedPassword: string) => {
    return this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  };

  createUserSession = async (data: {
    id: string;
    userId: string;
    refreshTokenHash: string;
    deviceName?: string;
    userAgent?: string;
    expiresAt: Date;
  }) => {
    return this.prisma.userSession.create({ data });
  };

  listActiveSessionsByUserId = async (userId: string) => {
    return this.prisma.userSession.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastUsedAt: 'desc' },
      select: {
        id: true,
        deviceName: true,
        userAgent: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
      },
    });
  };

  revokeSessionById = async (sessionId: string, userId: string) => {
    return this.prisma.userSession.updateMany({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  };

  revokeAllSessionsByUserId = async (userId: string) => {
    return this.prisma.userSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  };

  touchSession = async (sessionId: string) => {
    return this.prisma.userSession.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { lastUsedAt: new Date() },
    });
  };
}
