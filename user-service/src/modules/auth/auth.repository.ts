import { Prisma, PrismaClient } from "../../generated/prisma/client.js";

export class AuthRepository {
  constructor(private prisma: PrismaClient) {}

  getUserByEmailOrUsername = async (email?: string, username?: string) => {
    const orConditions: {email?: string, username?: string}[] = [];

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
}
