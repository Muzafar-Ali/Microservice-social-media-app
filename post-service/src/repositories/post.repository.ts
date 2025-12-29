
import { PrismaClient } from '../generated/prisma/client.js';
import { CreatePostInput, UpdatePostInput } from '../schema/post.schema.js';

export class PostRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreatePostInput & { userId: number }) {
    return this.prisma.post.create({
      data,
    });
  }

  async findById(id: number) {
    return this.prisma.post.findUnique({
      where: { id },
    });
  }

  async findAll() {
    return this.prisma.post.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async update(id: number, data: UpdatePostInput) {
    return this.prisma.post.update({
      where: { id },
      data,
    });
  }

  async delete(id: number) {
    return this.prisma.post.delete({
      where: { id },
    });
  }
}
