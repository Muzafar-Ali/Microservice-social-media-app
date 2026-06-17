import { PostRepository } from '../repositories/post.repository.js';
import { CreatePostDto, UpdatePostDto } from '../validation/post.validation.js';
import ApiErrorHandler from '../utils/apiErrorHandlerClass.js';
import { postCreatedCounter } from '../monitoring/metrics.js';
import { MediaType } from '../generated/prisma/enums.js';
import mapUserFeedPost from '../utils/mapUserFeedPost.js';
import { UserProfileCacheSummary } from '../types/post.types.js';
import { ApplyActiveFollowEventInput } from '../types/post-event-consumer.types..js';

export class PostService {
  constructor(private postRepository: PostRepository) {}

  async createPost(input: CreatePostDto, userId: string) {
    const post = await this.postRepository.createPostAndQueuePostCreatedEvent(input, userId);

    postCreatedCounter.inc();

    return post;
  }

  async getPostById(postId: string, viewerUserId: string) {
    const visiblePost = await this.requireVisiblePost(postId, viewerUserId);
    const post = await this.postRepository.findFeedPostById(visiblePost.id);

    if (!post) {
      throw new ApiErrorHandler(404, 'Post not found');
    }

    const [postWithViewerState] = await this.mapFeedPostsWithViewerState([post], viewerUserId);

    return postWithViewerState;
  }

  async getPostsByUserId(profileUserId: string, viewerUserId: string, query: { limit?: number; cursor?: string }) {
    await this.requireProfileAccess(viewerUserId, profileUserId);
    const limit = !query.limit || query.limit < 1 ? 30 : Math.min(query.limit, 50);
    const result = await this.postRepository.findPostsByUserId(profileUserId, {
      limit,
      cursor: query.cursor,
    });

    return {
      items: await this.mapFeedPostsWithViewerState(result.posts, viewerUserId),
      pagination: {
        limit,
        nextCursor: result.nextCursor,
        hasNextPage: result.hasNextPage,
      },
    };
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

  async getMyPosts(userId: string, query: { limit?: number; cursor?: string }) {
    const limit = !query.limit || query.limit < 1 ? 30 : Math.min(query.limit, 50);
    const result = await this.postRepository.findPostsByUserId(userId, {
      limit,
      cursor: query.cursor,
    });

    return {
      items: await this.mapFeedPostsWithViewerState(result.posts, userId),
      pagination: {
        limit,
        nextCursor: result.nextCursor,
        hasNextPage: result.hasNextPage,
      },
    };
  }

  async getHomeFeed(currentUserId: string, query: { limit?: number; cursor?: string }) {
    const limit = !query.limit || query.limit < 1 ? 20 : Math.min(query.limit, 50);

    const result = await this.postRepository.findHomeFeed({
      viewerUserId: currentUserId,
      limit,
      cursor: query.cursor,
    });

    return {
      items: await this.mapFeedPostsWithViewerState(result.posts, currentUserId),
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
      viewerUserId: currentUserId,
      cursor: query.cursor,
      limit,
    });

    return {
      items: await this.mapFeedPostsWithViewerState(result.posts, currentUserId),
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
      viewerUserId: currentUserId,
      cursor: query.cursor,
      limit,
    });

    return {
      items: await this.mapFeedPostsWithViewerState(result.posts, currentUserId),
      pagination: {
        limit,
        nextCursor: result.nextCursor,
        hasNextPage: result.hasNextPage,
        fetchedCount: result.posts.length,
      },
    };
  }

  async getUserGridPostsCursor(
    profileUserId: string,
    viewerUserId: string,
    query: { limit?: number; cursor?: string },
  ) {
    await this.requireProfileAccess(viewerUserId, profileUserId);

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

  async getUserGridPostsOffset(profileUserId: string, viewerUserId: string, query: { page?: number; limit?: number }) {
    await this.requireProfileAccess(viewerUserId, profileUserId);

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

  async getUserFeedWindow(profileUserId: string, viewerUserId: string, query: { postId: string; limit?: number }) {
    await this.requireProfileAccess(viewerUserId, profileUserId);

    const limit = !query.limit || query.limit < 1 ? 10 : Math.min(query.limit, 20);

    const result = await this.postRepository.findUserFeedWindow(profileUserId, {
      postId: query.postId,
      limit,
    });

    return {
      items: await this.mapFeedPostsWithViewerState(result.posts, viewerUserId),
      pagination: {
        anchorPostId: result.anchorPostId,
        nextCursor: result.nextCursor,
        hasNextPage: result.hasNextPage,
      },
    };
  }

  async getUserFeedAfter(profileUserId: string, viewerUserId: string, query: { cursor: string; limit?: number }) {
    await this.requireProfileAccess(viewerUserId, profileUserId);

    const limit = !query.limit || query.limit < 1 ? 10 : Math.min(query.limit, 20);

    const result = await this.postRepository.findUserFeedAfter(profileUserId, {
      cursor: query.cursor,
      limit,
    });

    return {
      items: await this.mapFeedPostsWithViewerState(result.posts, viewerUserId),
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

    return this.postRepository.updatePostAndQueuePostUpdatedEvent(postId, {
      content: input.content,
      editedAt: new Date(),
      isEdited: true,
    });
  }

  async deletePost(postId: string, userId: string) {
    const existingPost = await this.postRepository.findPostById(postId);
    if (!existingPost) {
      throw new ApiErrorHandler(404, 'Post not found');
    }

    if (existingPost.authorId !== userId) {
      throw new ApiErrorHandler(403, 'Forbidden');
    }

    const deletedPost = await this.postRepository.deletePostAndQueuePostDeletedEvent(postId);

    if (!deletedPost) {
      throw new ApiErrorHandler(404, 'Post not found');
    }
  }

  async likePost(postId: string, currentUserId: string) {
    await this.requireVisiblePost(postId, currentUserId);

    await this.postRepository.createPostLike(postId, currentUserId);

    const likesCount = await this.postRepository.countPostLikes(postId);

    return {
      postId,
      liked: true,
      likesCount,
    };
  }

  async unlikePost(postId: string, currentUserId: string) {
    await this.requireVisiblePost(postId, currentUserId);

    await this.postRepository.deletePostLike(postId, currentUserId);

    const likesCount = await this.postRepository.countPostLikes(postId);

    return {
      postId,
      liked: false,
      likesCount,
    };
  }

  async getPostLikes(postId: string, viewerUserId: string, query: { cursor?: string; limit?: number }) {
    const limit = !query.limit || query.limit < 1 ? 20 : Math.min(query.limit, 50);

    await this.requireVisiblePost(postId, viewerUserId);

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
    isPrivate: boolean;
  }) {
    return this.postRepository.upsertUserProfileCache(input);
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
    return this.postRepository.applyUserProfileEvent(input);
  }

  async applyActiveFollowEvent(input: ApplyActiveFollowEventInput): Promise<boolean> {
    return this.postRepository.applyActiveFollowEvent(input);
  }

  async createPostComment(postId: string, currentUserId: string, content: string) {
    await this.requireVisiblePost(postId, currentUserId);

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

  async getPostComments(postId: string, viewerUserId: string, query: { cursor?: string; limit?: number }) {
    const limit = !query.limit || query.limit < 1 ? 20 : Math.min(query.limit, 50);

    await this.requireVisiblePost(postId, viewerUserId);

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
    const post = await this.postRepository.findPostById(postId);
    if (!post) {
      throw new ApiErrorHandler(404, 'Post not found');
    }

    const comment = await this.postRepository.findCommentById(commentId);
    if (!comment) {
      throw new ApiErrorHandler(404, 'Comment not found');
    }

    if (comment.postId !== postId) {
      throw new ApiErrorHandler(400, 'Comment does not belong to this post');
    }

    const isCommentAuthor = comment.authorId === currentUserId;
    const isPostOwner = post.authorId === currentUserId;

    if (!isCommentAuthor && !isPostOwner) {
      throw new ApiErrorHandler(403, 'You are not allowed to delete this comment');
    }

    await this.postRepository.deleteComment(commentId);

    return {
      postId,
      commentId,
      deleted: true,
    };
  }

  private async requireProfileAccess(viewerUserId: string, profileUserId: string): Promise<void> {
    const canAccess = await this.postRepository.canViewerAccessProfile(viewerUserId, profileUserId);

    if (!canAccess) {
      throw new ApiErrorHandler(404, 'Profile posts not found');
    }
  }

  private async mapFeedPostsWithViewerState(posts: any[], viewerUserId: string) {
    const postIds = posts.map((post) => post.id);
    const authorIds = [...new Set(posts.map((post) => post.authorId))];

    const [likedPostIds, cachedProfiles] = await Promise.all([
      this.postRepository.findViewerLikedPostIds(viewerUserId, postIds),
      this.postRepository.findUserProfileCacheByIds(authorIds),
    ]);

    const cachedProfilesByUserId = new Map<string, UserProfileCacheSummary>(
      cachedProfiles.map((profile: any) => [profile.userId, profile]),
    );

    return posts.map((post) => {
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
          userId: viewerUserId,
          likedByMe: likedPostIds.has(post.id),
        },
      };
    });
  }

  private async requireVisiblePost(postId: string, viewerUserId: string) {
    const post = await this.postRepository.findPostById(postId);

    if (!post) {
      throw new ApiErrorHandler(404, 'Post not found');
    }

    const canAccess = await this.postRepository.canViewerAccessProfile(viewerUserId, post.authorId);

    if (!canAccess) {
      throw new ApiErrorHandler(404, 'Post not found');
    }

    return post;
  }
}
