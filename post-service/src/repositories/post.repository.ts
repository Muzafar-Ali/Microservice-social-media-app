
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
        themeKey: input.themeKey ?? null,
        media: input?.media?.length
          ? {
              create: input.media.map((item, index) => ({
                type: item.type === "image" ? MediaType.IMAGE : MediaType.VIDEO,
                url: item.url,
                publicId: item.publicId ?? null,
                thumbnailUrl: item.thumbnailUrl ?? null,
                duration: item.duration ?? null,
                width: item.width ?? null,
                height: item.height ?? null,
                order: index,
              })),
            }
          : undefined,
      },
      include: {
        media: true,
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
  
  async findUserGridPostsCursor(profileUserId: string, options: { limit: number; cursor?: string }): Promise<{ posts: UserGridPost[]; nextCursor: string | null; hasNextPage: boolean }> {
   
    const { limit, cursor } = options;

    const posts = await this.prisma.post.findMany({
      where: {
        authorId: profileUserId,
      },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: limit + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      select: userGridPostSelect,
    });

    const hasNextPage = posts.length > limit;
    const slicedPosts = hasNextPage ? posts.slice(0, limit) : posts;

    const nextCursor = hasNextPage && slicedPosts.length > 0
        ? slicedPosts[slicedPosts.length - 1].id
        : null;

    return {
      posts: slicedPosts,
      nextCursor,
      hasNextPage,
    };
  }

  async findUserGridPostsOffset( profileUserId: string, options: { page: number; limit: number }): Promise<{ posts: UserGridPost[]; total: number }> {

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
