
import { MediaType, PrismaClient } from '../generated/prisma/client.js';
import { UserFeedPost, userFeedPostSelect } from '../prisma/selects/userFeedPostSelect.js';
import { UserGridPost, userGridPostSelect } from '../prisma/selects/userGridPostSelect.js';
import ApiErrorHandler from '../utils/apiErrorHanlderClass.js';
import { CreatePostDto } from '../validation/post.validation.js';

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
  
  async findUserGridPostsCursor(
    profileUserId: string, 
    options: { limit: number; cursor?: string }
  ): Promise<{ 
    posts: UserGridPost[]; 
    nextCursor: string | null; 
    hasNextPage: boolean 
  }> {

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

  async findUserGridPostsOffset(
    profileUserId: string, 
    options: { page: number; limit: number }
  ): Promise<{
    posts: UserGridPost[]; 
    total: number 
  }> {

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
  
  async findUserFeedWindow(
    profileUserId: string,
    options: { postId: string; limit: number }
  ): Promise<{
    posts: UserFeedPost[];
    anchorPostId: string;
    nextCursor: string | null;
    hasNextPage: boolean;
  }> {
    const { postId, limit } = options;

    const anchorPost = await this.prisma.post.findFirst({
      where: {
        id: postId,
        authorId: profileUserId,
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    if (!anchorPost) {
      throw new ApiErrorHandler(404, "Selected post not found");
    }

    const clickedPost = await this.prisma.post.findFirst({
      where: {
        id: anchorPost.id,
        authorId: profileUserId,
      },
      select: userFeedPostSelect,
    });

    if (!clickedPost) {
      throw new ApiErrorHandler(404, "Selected post not found");
    }

    const olderTake = Math.max(limit - 1, 0);

    const olderPostsPlusOne = await this.prisma.post.findMany({
      where: {
        authorId: profileUserId,
        OR: [
          { createdAt: { lt: anchorPost.createdAt } },
          {
            createdAt: anchorPost.createdAt,
            id: { lt: anchorPost.id },
          },
        ],
      },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: olderTake + 1,
      select: userFeedPostSelect,
    });

    const hasNextPage = olderPostsPlusOne.length > olderTake;
    const slicedOlderPosts = hasNextPage
      ? olderPostsPlusOne.slice(0, olderTake)
      : olderPostsPlusOne;

    const posts = [clickedPost, ...slicedOlderPosts];

    const nextCursor =
      hasNextPage && posts.length > 0
        ? posts[posts.length - 1].id
        : null;

    return {
      posts,
      anchorPostId: clickedPost.id,
      nextCursor,
      hasNextPage,
    };
  }

  async findUserFeedAfter(
    profileUserId: string,
    options: { cursor: string; limit: number }
  ): Promise<{
    posts: UserFeedPost[];
    nextCursor: string | null;
    hasNextPage: boolean;
  }> {
    const { cursor, limit } = options;

    const cursorPost = await this.prisma.post.findFirst({
      where: {
        id: cursor,
        authorId: profileUserId,
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    if (!cursorPost) {
      throw new ApiErrorHandler(404, "Cursor post not found");
    }

    const posts = await this.prisma.post.findMany({
      where: {
        authorId: profileUserId,
        OR: [
          { createdAt: { lt: cursorPost.createdAt } },
          {
            createdAt: cursorPost.createdAt,
            id: { lt: cursorPost.id },
          },
        ],
      },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: limit + 1,
      select: userFeedPostSelect,
    });

    const hasNextPage = posts.length > limit;
    const slicedPosts = hasNextPage ? posts.slice(0, limit) : posts;

    const nextCursor =
      hasNextPage && slicedPosts.length > 0
        ? slicedPosts[slicedPosts.length - 1].id
        : null;

    return {
      posts: slicedPosts,
      nextCursor,
      hasNextPage,
    };
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
