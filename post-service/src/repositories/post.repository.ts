
import { MediaType, Prisma, PrismaClient } from '../generated/prisma/client.js';
import { CreatePostDto } from '../validation/post.validation.js';
import { UserGridPost, userGridPostSelect } from './post.repository.types.js';

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
        media: input.media?.length ? 
        {
          create: input.media.map((item, index) => ({
            type: item.type === "image" ? MediaType.IMAGE : MediaType.VIDEO,
            url: item.url,
            thumbnailUrl: item.thumbnailUrl ?? null,
            duration: item.duration ?? null,
            width: item.width ?? null,
            height: item.height ?? null,
            order: index,
          })),
        } 
        : undefined
      },
    });
  }

  async findById(id: string) {
    return this.prisma.post.findUnique({
      where: { id },
    });
  }

  async findPostsByUserId(profileUserId: string) {
    return this.prisma.post.findMany({
      where: { authorId: profileUserId },
      orderBy: { createdAt: 'desc' },
      include: {
        media: {
          orderBy: { order: 'asc' }
        },
        likes: true,
        comments: true,
      },
    });
  }
  
  async findUserGridPosts(
    profileUserId: string,
    options: { page: number; limit: number }
  ): Promise<{ posts: UserGridPost[]; total: number }> {

    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where: {
          authorId: profileUserId,
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
        select: userGridPostSelect,
      }),
      this.prisma.post.count({
        where: {
          authorId: profileUserId,
        },
      }),
    ]);

    return { posts, total };
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
