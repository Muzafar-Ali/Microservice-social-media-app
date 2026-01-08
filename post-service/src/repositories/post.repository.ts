
import { MediaType, PrismaClient } from '../generated/prisma/client.js';
import { CreatePostDto } from '../schema/post.schema.js';

type PostUpdate = {
  content?: string;
  editedAt?: Date;
  isEdited?: boolean;
}

export class PostRepository {
  constructor(private prisma: PrismaClient) {}

  async create(input: CreatePostDto, authorId: string) {
    return this.prisma.post.create({
      data: {
        authorId,
        content: input.content ?? "",
        media: input.media.length ? {
          create: input.media.map((item, index) => ({
            type: item.type === "image" ? MediaType.IMAGE : MediaType.VIDEO,
            url: item.url,
            thumbnailUrl: item.thumbnailUrl ?? null,
            duration: item.duration ?? null,
            width: item.width ?? null,
            height: item.height ?? null,

            // your prisma field is `order`
            order: item.order ?? index,
          })),
        } : undefined
      }
    });
  }

  async findById(id: string) {
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

  async findAllPaginated(skip: number, limit: number) {
    
    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        skip: skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      
      this.prisma.post.count()
    ])

    return {
      posts, 
      total
    }
  }

  async update(postId: string, data: PostUpdate) {
    return this.prisma.post.update({
      where: { id: postId },
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.post.delete({
      where: { id },
    });
  }
}
