
import { MediaType, PrismaClient } from '../generated/prisma/client.js';
import { UserFeedPost, userFeedPostSelect } from '../prisma/selects/userFeedPostSelect.js';
import { UserGridPost, userGridPostSelect } from '../prisma/selects/userGridPostSelect.js';
import { PostUpdate } from '../types/post.types.js';
import ApiErrorHandler from '../utils/apiErrorHanlderClass.js';
import { CreatePostDto } from '../validation/post.validation.js';


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

  async findPostById(postId: string) {
    return this.prisma.post.findUnique({
      where: { id: postId },
    });
  }

  async createPostLike(postId: string, userId: string) {
    try {
      return await this.prisma.postLike.create({
        data: {
          postId,
          userId,
        },
      });
    } catch (error) {
      return null;
    }
  }

  async deletePostLike(postId: string, userId: string) {
    try {
      return await this.prisma.postLike.delete({
        where: {
          postId_userId: {
            postId,
            userId,
          },
        },
      });
    } catch (error) {
      return null;
    }
  }

  async countPostLikes(postId: string) {
    return this.prisma.postLike.count({
      where: { postId },
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

  async findHomeFeed(options: { limit: number; cursor?: string }): Promise<{
    posts: UserFeedPost[];
    nextCursor: string | null;
    hasNextPage: boolean;
  }> {
    const { limit, cursor } = options;

    const posts = await this.prisma.post.findMany({
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

  async findPostLikes(
    postId: string,
    options: { cursor?: string; limit: number }
  ): Promise<{
    likes: Array<{ userId: string; createdAt: Date }>;
    nextCursor: string | null;
    hasNextPage: boolean;
  }> {
    const { cursor, limit } = options;

    let cursorLike: { createdAt: Date; userId: string } | null = null;

    if (cursor) {
      cursorLike = await this.prisma.postLike.findFirst({
        where: {
          postId,
          userId: cursor,
        },
        select: {
          createdAt: true,
          userId: true,
        },
      });

      if (!cursorLike) {
        throw new ApiErrorHandler(404, "Likes cursor not found");
      }
    }

    const likes = await this.prisma.postLike.findMany({
      where: {
        postId,
        ...(cursorLike
          ? {
              OR: [
                { createdAt: { lt: cursorLike.createdAt } },
                {
                  createdAt: cursorLike.createdAt,
                  userId: { lt: cursorLike.userId },
                },
              ],
            }
          : {}),
      },
      orderBy: [
        { createdAt: "desc" },
        { userId: "desc" },
      ],
      take: limit + 1,
      select: {
        userId: true,
        createdAt: true,
      },
    });

    const hasNextPage = likes.length > limit;
    const slicedLikes = hasNextPage ? likes.slice(0, limit) : likes;

    const nextCursor = hasNextPage && slicedLikes.length > 0
        ? slicedLikes[slicedLikes.length - 1].userId
        : null;

    return {
      likes: slicedLikes,
      nextCursor,
      hasNextPage,
    };
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

  async findUserProfileCacheByIds(userIds: string[]) {
    if (userIds.length === 0) {
      return [];
    }

    return this.prisma.userProfileCache.findMany({
      where: {
        userId: {
          in: userIds,
        },
      },
      select: {
        userId: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        status: true,
        updatedAt: true
      },
    });
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

  async upsertUserProfileCache(data: {
    userId: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    status: string;
  }) {
    return this.prisma.userProfileCache.upsert({
      where: { userId: data.userId },
      update: {
        username: data.username,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
        status: data.status,
      },
      create: {
        userId: data.userId,
        username: data.username,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
        status: data.status,
      },
    });
  }

  async createPostComment(postId: string, authorId: string, content: string) {
    return this.prisma.postComment.create({
      data: {
        postId,
        authorId,
        content,
      },
      select: {
        id: true,
        postId: true,
        authorId: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findPostComments(
    postId: string,
    options: { cursor?: string; limit: number }
  ): Promise<{
    comments: Array<{
      id: string;
      postId: string;
      authorId: string;
      content: string;
      createdAt: Date;
      updatedAt: Date;
    }>;
    nextCursor: string | null;
    hasNextPage: boolean;
  }> {
    const { cursor, limit } = options;

    const comments = await this.prisma.postComment.findMany({
      where: {
        postId,
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
      select: {
        id: true,
        postId: true,
        authorId: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const hasNextPage = comments.length > limit;
    const slicedComments = hasNextPage ? comments.slice(0, limit) : comments;

    const nextCursor =
      hasNextPage && slicedComments.length > 0
        ? slicedComments[slicedComments.length - 1].id
        : null;

    return {
      comments: slicedComments,
      nextCursor,
      hasNextPage,
    };
  }

  async findCommentById(commentId: string) {
    return this.prisma.postComment.findUnique({
      where: { id: commentId },
    });
  }

  async deleteComment(commentId: string) {
    return this.prisma.postComment.delete({
      where: { id: commentId },
    });
  }
}
