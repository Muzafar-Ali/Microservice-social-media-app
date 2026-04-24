import { PostRepository } from '../repositories/post.repository.js';
import { CreatePostDto, UpdatePostDto } from '../validation/post.validation.js';
import ApiErrorHandler from '../utils/apiErrorHandlerClass.js';
import { postCreatedCounter } from '../monitoring/metrics.js';
import { PostEventPublisher } from '../events/post-events.producer.js';
import { MediaType } from '../generated/prisma/enums.js';
import mapUserFeedPost from '../utils/mapUserFeedPost.js';
import { UserProfileCacheSummary } from '../types/post.types.js';

export class PostService {
  constructor(
    private postRepository: PostRepository,
    private postEventPublisher: PostEventPublisher,
  ) {}

  async createPost(input: CreatePostDto, userId: string) {
    const post = await this.postRepository.create(input, userId);

    postCreatedCounter.inc();

    await this.postEventPublisher.publishPostCreated({
      postId: post.id,
      authorId: post.authorId,
      content: post.content,
      themeKey: post.themeKey,
      isEdited: post.isEdited,
      editedAt: post.editedAt ? post.editedAt.toISOString() : null,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      media: post.media.map((mediaItem: any) => ({
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
    });

    return post;
  }

  async getPostById(postId: string) {
    return this.postRepository.findPostById(postId);
  }

  async getPostsByUserId(profileUserId: string) {
    return this.postRepository.findPostsByUserId(profileUserId);
  }

  async getAllPosts(page: number, limit: number, skip: number) {
    const { posts, total } = await this.postRepository.findAllPaginated(skip, limit);

    return {
      posts,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: skip + posts.length < total,
        hasPrevious: page > 1,
      },
    };
  }

  async getMyPosts(userId: string) {
    return this.postRepository.findPostsByUserId(userId);
  }

  async getHomeFeed(currentUserId: string, query: { limit?: number; cursor?: string }) {
    const limit = !query.limit || query.limit < 1 ? 20 : Math.min(query.limit, 50);

    const result = await this.postRepository.findHomeFeed({
      limit,
      cursor: query.cursor,
    });

    const authorIds = [...new Set(result.posts.map((post: any) => post.authorId))];
    const cachedProfiles = await this.postRepository.findUserProfileCacheByIds(authorIds);

    const cachedProfilesByUserId = new Map<string, UserProfileCacheSummary>(
      cachedProfiles.map((profile: any) => [profile.userId, profile]),
    );

    return {
      items: result.posts.map((post) => {
        const cachedProfile = cachedProfilesByUserId.get(post.authorId);
        const isUnknownUser = !cachedProfile || cachedProfile.status.toLowerCase() !== 'active';

        return {
          ...mapUserFeedPost(post),
          author: {
            userId: post.authorId,
            username: isUnknownUser ? 'unknown_user' : cachedProfile.username,
            displayName: isUnknownUser ? 'Unknown User' : (cachedProfile.displayName ?? null),
            avatarUrl: isUnknownUser ? null : (cachedProfile.avatarUrl ?? null),
            status: cachedProfile?.status ?? 'unknown',
          },
          viewer: {
            userId: currentUserId,
          },
        };
      }),
      pagination: {
        limit,
        nextCursor: result.nextCursor,
        hasNextPage: result.hasNextPage,
      },
    };
  }

  async getHomeFeedBefore(currentUserId: string, query: { limit?: number; cursor: string }) {
    const limit = !query.limit || query.limit < 1 ? 20 : Math.min(query.limit, 50);

    const result = await this.postRepository.findHomeFeedBefore({
      cursor: query.cursor,
      limit,
    });

    const authorIds = [...new Set(result.posts.map((post) => post.authorId))];
    const cachedProfiles = await this.postRepository.findUserProfileCacheByIds(authorIds);

    const cachedProfilesByUserId = new Map<string, UserProfileCacheSummary>(
      cachedProfiles.map((profile: any) => [profile.userId, profile]),
    );

    return {
      items: result.posts.map((post) => {
        const cachedProfile = cachedProfilesByUserId.get(post.authorId);
        const isUnknownUser = !cachedProfile || cachedProfile.status.toLowerCase() !== 'active';

        return {
          ...mapUserFeedPost(post),
          author: {
            userId: post.authorId,
            username: isUnknownUser ? 'unknown_user' : cachedProfile.username,
            displayName: isUnknownUser ? 'Unknown User' : (cachedProfile.displayName ?? null),
            avatarUrl: isUnknownUser ? null : (cachedProfile.avatarUrl ?? null),
            status: cachedProfile?.status ?? 'unknown',
          },
          viewer: {
            userId: currentUserId,
          },
        };
      }),
      pagination: {
        limit,
        hasNewer: result.hasNewer,
        fetchedCount: result.posts.length,
        topCursor: result.posts.length > 0 ? result.posts[0].id : query.cursor,
      },
    };
  }

  async getHomeFeedAfter(currentUserId: string, query: { limit?: number; cursor: string }) {
    const limit = !query.limit || query.limit < 1 ? 20 : Math.min(query.limit, 50);

    const result = await this.postRepository.findHomeFeedAfter({
      cursor: query.cursor,
      limit,
    });

    const authorIds = [...new Set(result.posts.map((post) => post.authorId))];
    const cachedProfiles = await this.postRepository.findUserProfileCacheByIds(authorIds);

    const cachedProfilesByUserId = new Map<string, UserProfileCacheSummary>(
      cachedProfiles.map((profile: any) => [profile.userId, profile]),
    );

    return {
      items: result.posts.map((post) => {
        const cachedProfile = cachedProfilesByUserId.get(post.authorId);
        const isUnknownUser = !cachedProfile || cachedProfile.status.toLowerCase() !== 'active';

        return {
          ...mapUserFeedPost(post),
          author: {
            userId: post.authorId,
            username: isUnknownUser ? 'unknown_user' : cachedProfile.username,
            displayName: isUnknownUser ? 'Unknown User' : (cachedProfile.displayName ?? null),
            avatarUrl: isUnknownUser ? null : (cachedProfile.avatarUrl ?? null),
            status: cachedProfile?.status ?? 'unknown',
          },
          viewer: {
            userId: currentUserId,
          },
        };
      }),
      pagination: {
        limit,
        nextCursor: result.nextCursor,
        hasNextPage: result.hasNextPage,
        fetchedCount: result.posts.length,
      },
    };
  }

  async getUserGridPostsCursor(profileUserId: string, query: { limit?: number; cursor?: string }) {
    const limit = !query.limit || query.limit < 1 ? 50 : Math.min(query.limit, 50);

    const result = await this.postRepository.findUserGridPostsCursor(profileUserId, {
      limit,
      cursor: query.cursor,
    });

    const items = result.posts.map((post) => {
      const trimmedContent = post.content.trim();
      const hasContent = trimmedContent.length > 0;
      const primaryMedia = post.media[0] ?? null;

      let previewType: 'text' | 'image' | 'video' | 'carousel';

      if (post._count.media === 0) {
        previewType = 'text';
      } else if (post._count.media > 1) {
        previewType = 'carousel';
      } else {
        previewType = primaryMedia?.type === MediaType.VIDEO ? 'video' : 'image';
      }

      return {
        id: post.id,
        previewType,
        contentPreview: hasContent ? trimmedContent.slice(0, 120) : null,
        hasContent,
        themeKey: post.themeKey ?? null,
        mediaCount: post._count.media,
        likesCount: post._count.likes,
        commentsCount: post._count.comments,
        primaryMedia: primaryMedia
          ? {
              type: primaryMedia.type === MediaType.IMAGE ? 'image' : 'video',
              url: primaryMedia.url,
              thumbnailUrl: primaryMedia.thumbnailUrl ?? null,
              width: primaryMedia.width ?? null,
              height: primaryMedia.height ?? null,
            }
          : null,
        createdAt: post.createdAt,
      };
    });

    return {
      items,
      pagination: {
        limit,
        nextCursor: result.nextCursor,
        hasNextPage: result.hasNextPage,
      },
    };
  }

  async getUserGridPostsOffset(profileUserId: string, query: { page?: number; limit?: number }) {
    const page = !query.page || query.page < 1 ? 1 : query.page;
    const limit = !query.limit || query.limit < 1 ? 50 : Math.min(query.limit, 50);

    const result = await this.postRepository.findUserGridPostsOffset(profileUserId, {
      page,
      limit,
    });

    const items = result.posts.map((post) => {
      const hasContent = post.content.trim().length > 0;
      const primaryMedia = post.media[0] ?? null;

      return {
        id: post.id,
        authorId: post.authorId,
        content: post.content,
        hasContent,
        themeKey: post.themeKey ?? null,
        mediaCount: post._count.media,
        primaryMedia: primaryMedia
          ? {
              type: primaryMedia.type === MediaType.IMAGE ? 'image' : 'video',
              url: primaryMedia.url,
              thumbnailUrl: primaryMedia.thumbnailUrl ?? null,
              width: primaryMedia.width ?? null,
              height: primaryMedia.height ?? null,
            }
          : null,
        createdAt: post.createdAt,
      };
    });

    return {
      items,
      pagination: {
        page,
        limit,
        total: result.total,
        hasNextPage: page * limit < result.total,
      },
    };
  }

  async getUserFeedWindow(profileUserId: string, query: { postId: string; limit?: number }) {
    const limit = !query.limit || query.limit < 1 ? 10 : Math.min(query.limit, 20);

    const result = await this.postRepository.findUserFeedWindow(profileUserId, {
      postId: query.postId,
      limit,
    });

    return {
      items: result.posts.map((post: any) => mapUserFeedPost(post)),
      pagination: {
        anchorPostId: result.anchorPostId,
        nextCursor: result.nextCursor,
        hasNextPage: result.hasNextPage,
      },
    };
  }

  async getUserFeedAfter(profileUserId: string, query: { cursor: string; limit?: number }) {
    const limit = !query.limit || query.limit < 1 ? 10 : Math.min(query.limit, 20);

    const result = await this.postRepository.findUserFeedAfter(profileUserId, {
      cursor: query.cursor,
      limit,
    });

    return {
      items: result.posts.map((post) => mapUserFeedPost(post)),
      pagination: {
        nextCursor: result.nextCursor,
        hasNextPage: result.hasNextPage,
      },
    };
  }

  async updatePost(input: UpdatePostDto, postId: string, authorId: string) {
    const existingPost = await this.postRepository.findPostById(postId);
    if (!existingPost) {
      throw new ApiErrorHandler(404, 'Post not found');
    }

    if (existingPost.authorId !== authorId) {
      throw new ApiErrorHandler(403, 'Forbidden');
    }

    const post = await this.postRepository.update(postId, {
      content: input.content,
      editedAt: new Date(),
      isEdited: true,
    });

    // postUpdatedCounter.inc();

    // try {
    //   await this.producer.send({
    //     topic: 'post-events',
    //     messages: [
    //       {
    //         key: 'post-updated',
    //         value: JSON.stringify(post),
    //       },
    //     ],
    //   });
    //   logger.info('Post updated event sent to Kafka');
    // } catch (error) {
    //   logger.error({error},'Failed to send post updated event to Kafka');
    // }

    return post;
  }

  async deletePost(postId: string, userId: string) {
    const existingPost = await this.postRepository.findPostById(postId);
    if (!existingPost) {
      throw new ApiErrorHandler(404, 'Post not found');
    }

    if (existingPost.authorId !== userId) {
      throw new ApiErrorHandler(403, 'Forbidden');
    }

    await this.postRepository.delete(postId);

    // postDeletedCounter.inc();

    // try {
    //   await this.producer.send({
    //     topic: 'post-events',
    //     messages: [
    //       {
    //         key: 'post-deleted',
    //         value: JSON.stringify({ id: postId }),
    //       },
    //     ],
    //   });
    //   logger.info('Post deleted event sent to Kafka');
    // } catch (error) {
    //   logger.error({error},'Failed to send post deleted event to Kafka');
    // }
  }

  async likePost(postId: string, currentUserId: string) {
    const postExists = await this.postRepository.findPostById(postId);
    if (!postExists) {
      throw new ApiErrorHandler(404, 'Post not found');
    }

    await this.postRepository.createPostLike(postId, currentUserId);

    const likesCount = await this.postRepository.countPostLikes(postId);

    return {
      postId,
      liked: true,
      likesCount,
    };
  }

  async unlikePost(postId: string, currentUserId: string) {
    const postExists = await this.postRepository.findPostById(postId);
    if (!postExists) {
      throw new ApiErrorHandler(404, 'Post not found');
    }

    await this.postRepository.deletePostLike(postId, currentUserId);

    const likesCount = await this.postRepository.countPostLikes(postId);

    return {
      postId,
      liked: false,
      likesCount,
    };
  }

  async getPostLikes(postId: string, query: { cursor?: string; limit?: number }) {
    const limit = !query.limit || query.limit < 1 ? 20 : Math.min(query.limit, 50);

    const postExists = await this.postRepository.findPostById(postId);
    if (!postExists) {
      throw new ApiErrorHandler(404, 'Post not found');
    }

    const result = await this.postRepository.findPostLikes(postId, {
      cursor: query.cursor,
      limit,
    });

    const likedUserIds = result.likes.map((like) => like.userId);

    const cachedProfiles = await this.postRepository.findUserProfileCacheByIds(likedUserIds);

    const cachedProfilesByUserId = new Map<string, UserProfileCacheSummary>(
      cachedProfiles.map((profile: any) => [profile.userId, profile]),
    );

    return {
      items: result.likes.map((like) => {
        const cachedProfile = cachedProfilesByUserId.get(like.userId);
        const isUnknownUser = !cachedProfile || cachedProfile.status.toLowerCase() !== 'active';

        return {
          userId: like.userId,
          username: isUnknownUser ? 'unknown_user' : cachedProfile.username,
          displayName: isUnknownUser ? 'Unknown User' : (cachedProfile.displayName ?? null),
          avatarUrl: isUnknownUser ? null : (cachedProfile.avatarUrl ?? null),
          status: cachedProfile?.status,
          likedAt: like.createdAt,
        };
      }),
      pagination: {
        nextCursor: result.nextCursor,
        hasNextPage: result.hasNextPage,
      },
    };
  }

  async upsertUserProfileCache(input: {
    userId: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    status: string;
  }) {
    return this.postRepository.upsertUserProfileCache(input);
  }

  async createPostComment(postId: string, currentUserId: string, content: string) {
    const postExists = await this.postRepository.findPostById(postId);
    if (!postExists) {
      throw new ApiErrorHandler(404, 'Post not found');
    }

    const createdComment = await this.postRepository.createPostComment(postId, currentUserId, content.trim());

    const cachedProfiles = await this.postRepository.findUserProfileCacheByIds([currentUserId]);
    const cachedProfile = cachedProfiles[0];
    const isUnknownUser = !cachedProfile || cachedProfile.status.toLowerCase() !== 'active';

    return {
      id: createdComment.id,
      postId: createdComment.postId,
      author: {
        userId: currentUserId,
        username: isUnknownUser ? 'unknown_user' : cachedProfile.username,
        displayName: isUnknownUser ? 'Unknown User' : (cachedProfile.displayName ?? null),
        avatarUrl: isUnknownUser ? null : (cachedProfile.avatarUrl ?? null),
        status: cachedProfile?.status ?? 'unknown',
      },
      content: createdComment.content,
      createdAt: createdComment.createdAt,
      updatedAt: createdComment.updatedAt,
    };
  }

  async getPostComments(postId: string, query: { cursor?: string; limit?: number }) {
    const limit = !query.limit || query.limit < 1 ? 20 : Math.min(query.limit, 50);

    const postExists = await this.postRepository.findPostById(postId);
    if (!postExists) {
      throw new ApiErrorHandler(404, 'Post not found');
    }

    const result = await this.postRepository.findPostComments(postId, {
      cursor: query.cursor,
      limit,
    });

    const authorIds = [...new Set(result.comments.map((comment) => comment.authorId))];
    const cachedProfiles = await this.postRepository.findUserProfileCacheByIds(authorIds);

    const cachedProfilesByUserId = new Map<string, UserProfileCacheSummary>(
      cachedProfiles.map((profile: any) => [profile.userId, profile]),
    );

    return {
      items: result.comments.map((comment) => {
        const cachedProfile = cachedProfilesByUserId.get(comment.authorId);

        const isUnknownUser = !cachedProfile || cachedProfile.status.toLowerCase() !== 'active';

        return {
          id: comment.id,
          postId: comment.postId,
          author: {
            userId: comment.authorId,
            username: isUnknownUser ? 'unknown_user' : cachedProfile.username,
            displayName: isUnknownUser ? 'Unknown User' : (cachedProfile.displayName ?? null),
            avatarUrl: isUnknownUser ? null : (cachedProfile.avatarUrl ?? null),
            status: cachedProfile?.status ?? 'unknown',
          },
          content: comment.content,
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt,
        };
      }),
      pagination: {
        nextCursor: result.nextCursor,
        hasNextPage: result.hasNextPage,
      },
    };
  }

  async deletePostComment(postId: string, commentId: string, currentUserId: string) {
    const postExists = await this.postRepository.findPostById(postId);
    if (!postExists) {
      throw new ApiErrorHandler(404, 'Post not found');
    }

    const comment = await this.postRepository.findCommentById(commentId);
    if (!comment) {
      throw new ApiErrorHandler(404, 'Comment not found');
    }

    if (comment.postId !== postId) {
      throw new ApiErrorHandler(400, 'Comment does not belong to this post');
    }

    if (comment.authorId !== currentUserId) {
      throw new ApiErrorHandler(403, 'You are not allowed to delete this comment');
    }

    await this.postRepository.deleteComment(commentId);

    return {
      postId,
      commentId,
      deleted: true,
    };
  }
}
