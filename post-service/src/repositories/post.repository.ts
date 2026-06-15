import crypto from 'node:crypto';
import { MediaType, Prisma, PrismaClient } from '../generated/prisma/client.js';
import config from '../config/config.js';
import { POST_EVENT_NAMES } from '../events/topics.js';
import { UserFeedPost, userFeedPostSelect } from '../prisma/selects/userFeedPostSelect.js';
import { UserGridPost, userGridPostSelect } from '../prisma/selects/userGridPostSelect.js';
import {
  PostCreatedEventPayload,
  PostDeletedEventPayload,
  PostUpdatedEventPayload,
} from '../types/post-event-publisher.types.js';
import { ApplyActiveFollowEventInput } from '../types/post-event-consumer.types..js';
import { PostUpdate } from '../types/post.types.js';
import ApiErrorHandler from '../utils/apiErrorHandlerClass.js';
import { CreatePostDto } from '../validation/post.validation.js';

export class PostRepository {
  constructor(private prisma: PrismaClient) {}

  async createPostAndQueuePostCreatedEvent(input: CreatePostDto, authorId: string) {
    return this.prisma.$transaction(async (transactionClient: Prisma.TransactionClient) => {
      const post = await transactionClient.post.create({
        data: {
          authorId,
          content: input.content ?? '',
          themeKey: input.themeKey ?? null,
          media: input.media?.length
            ? {
                create: input.media.map((item, index) => ({
                  type: item.type === 'image' ? MediaType.IMAGE : MediaType.VIDEO,
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

      const payload: PostCreatedEventPayload = {
        postId: post.id,
        authorId: post.authorId,
        content: post.content,
        themeKey: post.themeKey,
        isEdited: post.isEdited,
        editedAt: post.editedAt?.toISOString() ?? null,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
        media: post.media.map((mediaItem) => ({
          id: mediaItem.id,
          type: mediaItem.type,
          url: mediaItem.url,
          publicId: mediaItem.publicId,
          thumbnailUrl: mediaItem.thumbnailUrl,
          duration: mediaItem.duration,
          width: mediaItem.width,
          height: mediaItem.height,
          order: mediaItem.order,
        })),
      };

      await transactionClient.outboxEvent.create({
        data: {
          eventId: crypto.randomUUID(),
          eventName: POST_EVENT_NAMES.POST_CREATED,
          eventVersion: 1,
          aggregateId: post.id,
          partitionKey: post.id,
          payload,
          producerService: config.serviceName,
          occurredAt: new Date(),
          status: 'PENDING',
        },
      });

      return post;
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
          orderBy: { order: 'asc' },
        },
        likes: true,
        comments: true,
      },
    });
  }

  async findHomeFeed(options: { viewerUserId: string; limit: number; cursor?: string }): Promise<{
    posts: UserFeedPost[];
    nextCursor: string | null;
    hasNextPage: boolean;
  }> {
    const { viewerUserId, limit, cursor } = options;

    const cursorPost = cursor ? await this.findVisibleHomeFeedCursor(viewerUserId, cursor) : null;

    if (cursor && !cursorPost) {
      throw new ApiErrorHandler(404, 'Feed cursor not found');
    }

    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT p.id
        FROM "Post" p
        WHERE (
          p."authorId" = ${viewerUserId}
          OR EXISTS (
            SELECT 1
            FROM "ActiveFollow" af
            WHERE af."followerId" = ${viewerUserId}
              AND af."followeeId" = p."authorId"
          )
        )
        ${
          cursorPost
            ? Prisma.sql`
                AND (
                  p."createdAt" < ${cursorPost.createdAt}
                  OR (
                    p."createdAt" = ${cursorPost.createdAt}
                    AND p.id < ${cursorPost.id}
                  )
                )
              `
            : Prisma.empty
        }
        ORDER BY p."createdAt" DESC, p.id DESC
        LIMIT ${limit + 1}
      `,
    );

    const posts = await this.findFeedPostsByOrderedIds(rows.map((row) => row.id));

    const hasNextPage = posts.length > limit;
    const slicedPosts = hasNextPage ? posts.slice(0, limit) : posts;

    const nextCursor = hasNextPage && slicedPosts.length > 0 ? slicedPosts[slicedPosts.length - 1].id : null;

    return {
      posts: slicedPosts,
      nextCursor,
      hasNextPage,
    };
  }

  async findHomeFeedBefore(options: { viewerUserId: string; cursor: string; limit: number }): Promise<{
    posts: UserFeedPost[];
    hasNewer: boolean;
  }> {
    const { viewerUserId, cursor, limit } = options;

    const cursorPost = await this.findVisibleHomeFeedCursor(viewerUserId, cursor);

    if (!cursorPost) {
      throw new ApiErrorHandler(404, 'Feed cursor not found');
    }

    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT p.id
      FROM "Post" p
      WHERE (
        p."authorId" = ${viewerUserId}
        OR EXISTS (
          SELECT 1
          FROM "ActiveFollow" af
          WHERE af."followerId" = ${viewerUserId}
            AND af."followeeId" = p."authorId"
        )
      )
      AND (
        p."createdAt" > ${cursorPost.createdAt}
        OR (
          p."createdAt" = ${cursorPost.createdAt}
          AND p.id > ${cursorPost.id}
        )
      )
      ORDER BY p."createdAt" DESC, p.id DESC
      LIMIT ${limit + 1}
    `;

    const posts = await this.findFeedPostsByOrderedIds(rows.map((row) => row.id));

    const hasNewer = posts.length > limit;
    const slicedPosts = hasNewer ? posts.slice(0, limit) : posts;

    return {
      posts: slicedPosts,
      hasNewer,
    };
  }

  async findHomeFeedAfter(options: { viewerUserId: string; cursor: string; limit: number }): Promise<{
    posts: UserFeedPost[];
    nextCursor: string | null;
    hasNextPage: boolean;
  }> {
    const { viewerUserId, cursor, limit } = options;

    const cursorPost = await this.findVisibleHomeFeedCursor(viewerUserId, cursor);

    if (!cursorPost) {
      throw new ApiErrorHandler(404, 'Feed cursor not found');
    }

    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT p.id
      FROM "Post" p
      WHERE (
        p."authorId" = ${viewerUserId}
        OR EXISTS (
          SELECT 1
          FROM "ActiveFollow" af
          WHERE af."followerId" = ${viewerUserId}
            AND af."followeeId" = p."authorId"
        )
      )
      AND (
        p."createdAt" < ${cursorPost.createdAt}
        OR (
          p."createdAt" = ${cursorPost.createdAt}
          AND p.id < ${cursorPost.id}
        )
      )
      ORDER BY p."createdAt" DESC, p.id DESC
      LIMIT ${limit + 1}
    `;

    const posts = await this.findFeedPostsByOrderedIds(rows.map((row) => row.id));

    const hasNextPage = posts.length > limit;
    const slicedPosts = hasNextPage ? posts.slice(0, limit) : posts;

    const nextCursor = hasNextPage && slicedPosts.length > 0 ? slicedPosts[slicedPosts.length - 1].id : null;

    return {
      posts: slicedPosts,
      nextCursor,
      hasNextPage,
    };
  }

  private async findVisibleHomeFeedCursor(
    viewerUserId: string,
    postId: string,
  ): Promise<{ id: string; createdAt: Date } | null> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string; createdAt: Date }>>`
      SELECT p.id, p."createdAt"
      FROM "Post" p
      WHERE p.id = ${postId}
        AND (
          p."authorId" = ${viewerUserId}
          OR EXISTS (
            SELECT 1
            FROM "ActiveFollow" af
            WHERE af."followerId" = ${viewerUserId}
              AND af."followeeId" = p."authorId"
          )
        )
      LIMIT 1
    `;

    return rows[0] ?? null;
  }

  private async findFeedPostsByOrderedIds(postIds: string[]): Promise<UserFeedPost[]> {
    if (postIds.length === 0) {
      return [];
    }

    const posts = await this.prisma.post.findMany({
      where: {
        id: {
          in: postIds,
        },
      },
      select: userFeedPostSelect,
    });

    const postOrder = new Map(postIds.map((postId, index) => [postId, index]));

    return posts.sort((leftPost, rightPost) => (postOrder.get(leftPost.id) ?? 0) - (postOrder.get(rightPost.id) ?? 0));
  }

  async findPostLikes(
    postId: string,
    options: { cursor?: string; limit: number },
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
        throw new ApiErrorHandler(404, 'Likes cursor not found');
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
      orderBy: [{ createdAt: 'desc' }, { userId: 'desc' }],
      take: limit + 1,
      select: {
        userId: true,
        createdAt: true,
      },
    });

    const hasNextPage = likes.length > limit;
    const slicedLikes = hasNextPage ? likes.slice(0, limit) : likes;

    const nextCursor = hasNextPage && slicedLikes.length > 0 ? slicedLikes[slicedLikes.length - 1].userId : null;

    return {
      likes: slicedLikes,
      nextCursor,
      hasNextPage,
    };
  }

  async findUserGridPostsCursor(
    profileUserId: string,
    options: { limit: number; cursor?: string },
  ): Promise<{
    posts: UserGridPost[];
    nextCursor: string | null;
    hasNextPage: boolean;
  }> {
    const { limit, cursor } = options;

    const posts = await this.prisma.post.findMany({
      where: {
        authorId: profileUserId,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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

    const nextCursor = hasNextPage && slicedPosts.length > 0 ? slicedPosts[slicedPosts.length - 1].id : null;

    return {
      posts: slicedPosts,
      nextCursor,
      hasNextPage,
    };
  }

  async findUserGridPostsOffset(
    profileUserId: string,
    options: { page: number; limit: number },
  ): Promise<{
    posts: UserGridPost[];
    total: number;
  }> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where: {
          authorId: profileUserId,
        },
        orderBy: {
          createdAt: 'desc',
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
        isPrivate: true,
        updatedAt: true,
      },
    });
  }

  async canViewerAccessProfile(viewerUserId: string, profileUserId: string): Promise<boolean> {
    const profile = await this.prisma.userProfileCache.findUnique({
      where: {
        userId: profileUserId,
      },
      select: {
        status: true,
        isPrivate: true,
      },
    });

    if (!profile || profile.status.toUpperCase() !== 'ACTIVE') {
      return false;
    }

    if (viewerUserId === profileUserId || !profile.isPrivate) {
      return true;
    }

    const activeFollow = await this.prisma.activeFollow.findUnique({
      where: {
        followerId_followeeId: {
          followerId: viewerUserId,
          followeeId: profileUserId,
        },
      },
      select: {
        followerId: true,
      },
    });

    return activeFollow !== null;
  }

  async findUserFeedWindow(
    profileUserId: string,
    options: { postId: string; limit: number },
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
      throw new ApiErrorHandler(404, 'Selected post not found');
    }

    const clickedPost = await this.prisma.post.findFirst({
      where: {
        id: anchorPost.id,
        authorId: profileUserId,
      },
      select: userFeedPostSelect,
    });

    if (!clickedPost) {
      throw new ApiErrorHandler(404, 'Selected post not found');
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
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: olderTake + 1,
      select: userFeedPostSelect,
    });

    const hasNextPage = olderPostsPlusOne.length > olderTake;
    const slicedOlderPosts = hasNextPage ? olderPostsPlusOne.slice(0, olderTake) : olderPostsPlusOne;

    const posts = [clickedPost, ...slicedOlderPosts];

    const nextCursor = hasNextPage && posts.length > 0 ? posts[posts.length - 1].id : null;

    return {
      posts,
      anchorPostId: clickedPost.id,
      nextCursor,
      hasNextPage,
    };
  }

  async findUserFeedAfter(
    profileUserId: string,
    options: { cursor: string; limit: number },
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
      throw new ApiErrorHandler(404, 'Cursor post not found');
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
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: userFeedPostSelect,
    });

    const hasNextPage = posts.length > limit;
    const slicedPosts = hasNextPage ? posts.slice(0, limit) : posts;

    const nextCursor = hasNextPage && slicedPosts.length > 0 ? slicedPosts[slicedPosts.length - 1].id : null;

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

      this.prisma.post.count(),
    ]);

    return {
      posts,
      total,
    };
  }

  async updatePostAndQueuePostUpdatedEvent(postId: string, data: PostUpdate) {
    return this.prisma.$transaction(async (transactionClient: Prisma.TransactionClient) => {
      const post = await transactionClient.post.update({
        where: { id: postId },
        data,
      });

      const payload: PostUpdatedEventPayload = {
        postId: post.id,
        authorId: post.authorId,
        content: post.content,
        themeKey: post.themeKey,
        isEdited: post.isEdited,
        editedAt: post.editedAt?.toISOString() ?? null,
        updatedAt: post.updatedAt.toISOString(),
      };

      await transactionClient.outboxEvent.create({
        data: {
          eventId: crypto.randomUUID(),
          eventName: POST_EVENT_NAMES.POST_UPDATED,
          eventVersion: 1,
          aggregateId: post.id,
          partitionKey: post.id,
          payload,
          producerService: config.serviceName,
          occurredAt: new Date(),
          status: 'PENDING',
        },
      });

      return post;
    });
  }

  async deletePostAndQueuePostDeletedEvent(postId: string) {
    return this.prisma.$transaction(async (transactionClient: Prisma.TransactionClient) => {
      const post = await transactionClient.post.findUnique({
        where: { id: postId },
        include: {
          media: {
            select: {
              id: true,
              type: true,
              publicId: true,
            },
          },
        },
      });

      if (!post) {
        return null;
      }

      const deletedAt = new Date();
      const payload: PostDeletedEventPayload = {
        postId: post.id,
        authorId: post.authorId,
        deletedAt: deletedAt.toISOString(),
        media: post.media.map((mediaItem) => ({
          id: mediaItem.id,
          type: mediaItem.type,
          publicId: mediaItem.publicId,
        })),
      };

      await transactionClient.post.delete({
        where: { id: post.id },
      });

      await transactionClient.outboxEvent.create({
        data: {
          eventId: crypto.randomUUID(),
          eventName: POST_EVENT_NAMES.POST_DELETED,
          eventVersion: 1,
          aggregateId: post.id,
          partitionKey: post.id,
          payload,
          producerService: config.serviceName,
          occurredAt: deletedAt,
          status: 'PENDING',
        },
      });

      return post;
    });
  }

  async upsertUserProfileCache(input: {
    userId: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    status: string;
    isPrivate: boolean;
  }) {
    return this.prisma.userProfileCache.upsert({
      where: { userId: input.userId },
      update: {
        username: input.username,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
        status: input.status,
        isPrivate: input.isPrivate,
      },
      create: {
        userId: input.userId,
        username: input.username,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
        status: input.status,
        isPrivate: input.isPrivate,
      },
    });
  }

  async applyUserProfileEvent(input: {
    eventId: string;
    userId: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    status: string;
    isPrivate: boolean;
  }): Promise<boolean> {
    return this.prisma.$transaction(async (transactionClient: Prisma.TransactionClient) => {
      const insertedRows = await transactionClient.$executeRaw`
        INSERT INTO "ProcessedEvent" (
          "id",
          "eventId",
          "consumerName",
          "processedAt"
        )
        VALUES (
          ${crypto.randomUUID()}::uuid,
          ${input.eventId},
          'post-service:user-profile-projection',
          NOW()
        )
        ON CONFLICT ("eventId", "consumerName") DO NOTHING
      `;

      if (insertedRows === 0) {
        return false;
      }

      await transactionClient.userProfileCache.upsert({
        where: { userId: input.userId },
        update: {
          username: input.username,
          displayName: input.displayName,
          avatarUrl: input.avatarUrl,
          status: input.status,
          isPrivate: input.isPrivate,
        },
        create: {
          userId: input.userId,
          username: input.username,
          displayName: input.displayName,
          avatarUrl: input.avatarUrl,
          status: input.status,
          isPrivate: input.isPrivate,
        },
      });

      return true;
    });
  }

  async applyActiveFollowEvent(input: ApplyActiveFollowEventInput): Promise<boolean> {
    return this.prisma.$transaction(async (transactionClient: Prisma.TransactionClient) => {
      const insertedRows = await transactionClient.$executeRaw`
        INSERT INTO "ProcessedEvent" (
          "id",
          "eventId",
          "consumerName",
          "processedAt"
        )
        VALUES (
          ${crypto.randomUUID()}::uuid,
          ${input.eventId},
          'post-service:active-follow-projection',
          NOW()
        )
        ON CONFLICT ("eventId", "consumerName") DO NOTHING
      `;

      if (insertedRows === 0) {
        return false;
      }

      if (input.eventName === 'follow.removed') {
        await transactionClient.activeFollow.deleteMany({
          where: {
            followerId: input.followerId,
            followeeId: input.followeeId,
          },
        });
      } else {
        await transactionClient.activeFollow.upsert({
          where: {
            followerId_followeeId: {
              followerId: input.followerId,
              followeeId: input.followeeId,
            },
          },
          update: {
            followedAt: input.occurredAt,
          },
          create: {
            followerId: input.followerId,
            followeeId: input.followeeId,
            followedAt: input.occurredAt,
          },
        });
      }

      return true;
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
    options: { cursor?: string; limit: number },
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
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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

    const nextCursor = hasNextPage && slicedComments.length > 0 ? slicedComments[slicedComments.length - 1].id : null;

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
