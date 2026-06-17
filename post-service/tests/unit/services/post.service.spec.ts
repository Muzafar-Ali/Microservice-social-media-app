import { jest } from '@jest/globals';

jest.mock('../../../src/monitoring/metrics.js', () => ({
  __esModule: true,
  feedItemsReturnedHistogram: { observe: jest.fn() },
  feedRequestsTotal: { inc: jest.fn() },
  postCreatedCounter: { inc: jest.fn() },
  postEngagementActionsTotal: { inc: jest.fn() },
  postMediaItemsHistogram: { observe: jest.fn() },
  postOperationsTotal: { inc: jest.fn() },
}));

jest.mock('../../../src/generated/prisma/client.js', () => ({
  __esModule: true,
  MediaType: {
    IMAGE: 'IMAGE',
    VIDEO: 'VIDEO',
  },
}));

import { PostService } from '../../../src/services/post.service.js';
import { MediaType } from '../../../src/generated/prisma/enums.js';
import {
  feedItemsReturnedHistogram,
  feedRequestsTotal,
  postCreatedCounter,
  postEngagementActionsTotal,
  postMediaItemsHistogram,
  postOperationsTotal,
} from '../../../src/monitoring/metrics.js';
import {
  createComment,
  createCreatePostDto,
  createFeedPost,
  createImageMedia,
  createProfileCache,
  createVideoMedia,
  testCreatedAt,
  testUpdatedAt,
} from '../../factories/post.factory.js';

const createRepositoryMock = () => ({
  createPostAndQueuePostCreatedEvent: jest.fn(),
  findPostById: jest.fn(),
  findFeedPostById: jest.fn(),
  canViewerAccessProfile: jest.fn(),
  findPostsByUserId: jest.fn(),
  findAllPaginated: jest.fn(),
  findHomeFeed: jest.fn(),
  findHomeFeedBefore: jest.fn(),
  findHomeFeedAfter: jest.fn(),
  findUserGridPostsCursor: jest.fn(),
  findUserGridPostsOffset: jest.fn(),
  findUserFeedWindow: jest.fn(),
  findUserFeedAfter: jest.fn(),
  updatePostAndQueuePostUpdatedEvent: jest.fn(),
  deletePostAndQueuePostDeletedEvent: jest.fn(),
  createPostLike: jest.fn(),
  deletePostLike: jest.fn(),
  countPostLikes: jest.fn(),
  findPostLikes: jest.fn(),
  findUserProfileCacheByIds: jest.fn(),
  findViewerLikedPostIds: jest.fn(),
  upsertUserProfileCache: jest.fn(),
  applyUserProfileEvent: jest.fn(),
  applyActiveFollowEvent: jest.fn(),
  createPostComment: jest.fn(),
  findPostComments: jest.fn(),
  findCommentById: jest.fn(),
  deleteComment: jest.fn(),
});

describe('PostService', () => {
  let repository: ReturnType<typeof createRepositoryMock>;
  let postService: PostService;

  beforeEach(() => {
    jest.clearAllMocks();

    repository = createRepositoryMock();
    postService = new PostService(repository as never);

    repository.canViewerAccessProfile.mockResolvedValue(true as never);
    repository.findViewerLikedPostIds.mockResolvedValue(new Set<string>() as never);
    repository.findUserProfileCacheByIds.mockResolvedValue([createProfileCache()] as never);
  });

  describe('createPost', () => {
    it('creates a media post through the transactional repository and records creation metrics', async () => {
      const input = createCreatePostDto({
        media: [
          {
            type: 'image',
            url: 'https://res.cloudinary.com/demo/image/upload/social-media-app/posts/images/post.jpg',
            publicId: 'social-media-app/posts/images/post',
          },
        ],
      });
      const createdPost = createFeedPost({ content: 'Launch post' });

      repository.createPostAndQueuePostCreatedEvent.mockResolvedValue(createdPost as never);

      const result = await postService.createPost(input as never, 'author-1');

      expect(repository.createPostAndQueuePostCreatedEvent).toHaveBeenCalledWith(input, 'author-1');
      expect(result).toBe(createdPost);
      expect(postCreatedCounter.inc).toHaveBeenCalledTimes(1);
      expect(postOperationsTotal.inc).toHaveBeenCalledWith({ operation: 'create' });
      expect(postMediaItemsHistogram.observe).toHaveBeenCalledWith(1);
    });

    it('records zero media items for text-only posts', async () => {
      const input = { content: 'Text only' };
      repository.createPostAndQueuePostCreatedEvent.mockResolvedValue(createFeedPost(input) as never);

      await postService.createPost(input as never, 'author-1');

      expect(postMediaItemsHistogram.observe).toHaveBeenCalledWith(0);
    });
  });

  describe('feeds and visibility', () => {
    it('returns home feed posts with author summary, viewer like state, pagination, and feed metrics', async () => {
      const posts = [
        createFeedPost({
          id: 'post-liked',
          media: [createImageMedia()],
          _count: { media: 1, likes: 3, comments: 2 },
        }),
      ];

      repository.findHomeFeed.mockResolvedValue({
        posts,
        nextCursor: 'cursor-2',
        hasNextPage: true,
      } as never);
      repository.findViewerLikedPostIds.mockResolvedValue(new Set(['post-liked']) as never);

      const result = await postService.getHomeFeed('viewer-1', { limit: 100, cursor: 'cursor-1' });

      expect(repository.findHomeFeed).toHaveBeenCalledWith({
        viewerUserId: 'viewer-1',
        limit: 50,
        cursor: 'cursor-1',
      });
      expect(repository.findViewerLikedPostIds).toHaveBeenCalledWith('viewer-1', ['post-liked']);
      expect(repository.findUserProfileCacheByIds).toHaveBeenCalledWith(['author-1']);
      expect(result).toEqual({
        items: [
          expect.objectContaining({
            id: 'post-liked',
            author: {
              userId: 'author-1',
              username: 'author_one',
              displayName: 'Author One',
              avatarUrl: 'https://cdn.example.com/avatar.jpg',
              status: 'active',
            },
            viewer: {
              userId: 'viewer-1',
              likedByMe: true,
            },
            media: [
              expect.objectContaining({
                type: 'image',
                url: 'https://cdn.example.com/image.jpg',
              }),
            ],
          }),
        ],
        pagination: {
          limit: 50,
          nextCursor: 'cursor-2',
          hasNextPage: true,
        },
      });
      expect(feedRequestsTotal.inc).toHaveBeenCalledWith({ feed_type: 'home' });
      expect(feedItemsReturnedHistogram.observe).toHaveBeenCalledWith({ feed_type: 'home' }, 1);
    });

    it('falls back to an unknown author summary when profile cache is missing or inactive', async () => {
      repository.findHomeFeed.mockResolvedValue({
        posts: [createFeedPost()],
        nextCursor: null,
        hasNextPage: false,
      } as never);
      repository.findUserProfileCacheByIds.mockResolvedValue([] as never);

      const result = await postService.getHomeFeed('viewer-1', {});

      expect(result.items[0].author).toEqual({
        userId: 'author-1',
        username: 'unknown_user',
        displayName: 'Unknown User',
        avatarUrl: null,
        status: 'unknown',
      });
    });

    it('rejects inaccessible profile feeds before reading posts', async () => {
      repository.canViewerAccessProfile.mockResolvedValue(false as never);

      await expect(postService.getPostsByUserId('private-user', 'viewer-1', {})).rejects.toMatchObject({
        statusCode: 404,
        message: 'Profile posts not found',
      });

      expect(repository.findPostsByUserId).not.toHaveBeenCalled();
    });

    it('rejects inaccessible post detail before loading rich feed payload', async () => {
      repository.findPostById.mockResolvedValue(createFeedPost({ authorId: 'private-user' }) as never);
      repository.canViewerAccessProfile.mockResolvedValue(false as never);

      await expect(postService.getPostById('post-1', 'viewer-1')).rejects.toMatchObject({
        statusCode: 404,
        message: 'Post not found',
      });

      expect(repository.findFeedPostById).not.toHaveBeenCalled();
    });

    it('returns rich post detail with video media, author summary, and viewer like state', async () => {
      repository.findPostById.mockResolvedValue(createFeedPost({ id: 'post-video' }) as never);
      repository.findFeedPostById.mockResolvedValue(
        createFeedPost({
          id: 'post-video',
          media: [createVideoMedia()],
          _count: { media: 1, likes: 9, comments: 4 },
        }) as never,
      );
      repository.findViewerLikedPostIds.mockResolvedValue(new Set(['post-video']) as never);

      const result = await postService.getPostById('post-video', 'viewer-1');

      expect(repository.findPostById).toHaveBeenCalledWith('post-video');
      expect(repository.findFeedPostById).toHaveBeenCalledWith('post-video');
      expect(result).toEqual(
        expect.objectContaining({
          id: 'post-video',
          mediaCount: 1,
          likesCount: 9,
          commentsCount: 4,
          media: [
            expect.objectContaining({
              type: 'video',
              thumbnailUrl: 'https://cdn.example.com/video-thumb.jpg',
              duration: 30,
            }),
          ],
          viewer: {
            userId: 'viewer-1',
            likedByMe: true,
          },
        }),
      );
    });

    it('throws 404 when rich post detail disappears after visibility check', async () => {
      repository.findPostById.mockResolvedValue(createFeedPost({ id: 'post-1' }) as never);
      repository.findFeedPostById.mockResolvedValue(null as never);

      await expect(postService.getPostById('post-1', 'viewer-1')).rejects.toMatchObject({
        statusCode: 404,
        message: 'Post not found',
      });
    });

    it('returns profile posts for an accessible profile with normalized limit and metrics', async () => {
      repository.findPostsByUserId.mockResolvedValue({
        posts: [createFeedPost({ id: 'profile-post' })],
        nextCursor: 'next-profile-post',
        hasNextPage: true,
      } as never);

      const result = await postService.getPostsByUserId('profile-1', 'viewer-1', {
        limit: 999,
        cursor: 'cursor-1',
      });

      expect(repository.findPostsByUserId).toHaveBeenCalledWith('profile-1', {
        limit: 50,
        cursor: 'cursor-1',
      });
      expect(result.pagination).toEqual({
        limit: 50,
        nextCursor: 'next-profile-post',
        hasNextPage: true,
      });
      expect(result.items[0]).toEqual(expect.objectContaining({ id: 'profile-post' }));
      expect(feedRequestsTotal.inc).toHaveBeenCalledWith({ feed_type: 'profile_posts' });
    });

    it('returns current user posts with default limit and viewer state', async () => {
      repository.findPostsByUserId.mockResolvedValue({
        posts: [createFeedPost({ id: 'my-post' })],
        nextCursor: null,
        hasNextPage: false,
      } as never);

      const result = await postService.getMyPosts('user-1', {});

      expect(repository.findPostsByUserId).toHaveBeenCalledWith('user-1', {
        limit: 30,
        cursor: undefined,
      });
      expect(result.items[0]).toEqual(
        expect.objectContaining({
          id: 'my-post',
          viewer: {
            userId: 'user-1',
            likedByMe: false,
          },
        }),
      );
      expect(feedRequestsTotal.inc).toHaveBeenCalledWith({ feed_type: 'my_posts' });
    });

    it('returns paginated all-posts metadata for admin/simple listing flows', async () => {
      repository.findAllPaginated.mockResolvedValue({
        posts: [createFeedPost({ id: 'post-1' }), createFeedPost({ id: 'post-2' })],
        total: 5,
      } as never);

      const result = await postService.getAllPosts(2, 2, 2);

      expect(repository.findAllPaginated).toHaveBeenCalledWith(2, 2);
      expect(result).toEqual({
        posts: [expect.objectContaining({ id: 'post-1' }), expect.objectContaining({ id: 'post-2' })],
        meta: {
          page: 2,
          limit: 2,
          total: 5,
          totalPages: 3,
          hasNextPage: true,
          hasPrevious: true,
        },
      });
    });

    it('returns newer home feed posts before the current top cursor', async () => {
      repository.findHomeFeedBefore.mockResolvedValue({
        posts: [createFeedPost({ id: 'newer-post' })],
        hasNewer: true,
      } as never);

      const result = await postService.getHomeFeedBefore('viewer-1', {
        cursor: 'current-top',
        limit: 0,
      });

      expect(repository.findHomeFeedBefore).toHaveBeenCalledWith({
        viewerUserId: 'viewer-1',
        cursor: 'current-top',
        limit: 20,
      });
      expect(result.pagination).toEqual({
        limit: 20,
        hasNewer: true,
        fetchedCount: 1,
        topCursor: 'newer-post',
      });
      expect(feedRequestsTotal.inc).toHaveBeenCalledWith({ feed_type: 'home_before' });
    });

    it('keeps the existing top cursor when no newer home feed posts are returned', async () => {
      repository.findHomeFeedBefore.mockResolvedValue({
        posts: [],
        hasNewer: false,
      } as never);

      const result = await postService.getHomeFeedBefore('viewer-1', {
        cursor: 'current-top',
        limit: 20,
      });

      expect(result.pagination.topCursor).toBe('current-top');
      expect(result.pagination.fetchedCount).toBe(0);
    });

    it('returns older home feed posts after the bottom cursor', async () => {
      repository.findHomeFeedAfter.mockResolvedValue({
        posts: [createFeedPost({ id: 'older-post' })],
        nextCursor: 'older-post',
        hasNextPage: true,
      } as never);

      const result = await postService.getHomeFeedAfter('viewer-1', {
        cursor: 'bottom-post',
        limit: 60,
      });

      expect(repository.findHomeFeedAfter).toHaveBeenCalledWith({
        viewerUserId: 'viewer-1',
        cursor: 'bottom-post',
        limit: 50,
      });
      expect(result.pagination).toEqual({
        limit: 50,
        nextCursor: 'older-post',
        hasNextPage: true,
        fetchedCount: 1,
      });
      expect(feedRequestsTotal.inc).toHaveBeenCalledWith({ feed_type: 'home_after' });
    });
  });

  describe('profile grid and anchored feed flow', () => {
    it('maps cursor grid posts into compact text, image, video, and carousel previews', async () => {
      repository.findUserGridPostsCursor.mockResolvedValue({
        posts: [
          createFeedPost({ id: 'text-post', content: '   themed text   ', _count: { media: 0, likes: 1, comments: 0 } }),
          createFeedPost({
            id: 'image-post',
            media: [createImageMedia()],
            _count: { media: 1, likes: 2, comments: 1 },
          }),
          createFeedPost({
            id: 'video-post',
            media: [createVideoMedia()],
            _count: { media: 1, likes: 3, comments: 2 },
          }),
          createFeedPost({
            id: 'carousel-post',
            media: [createImageMedia(), createVideoMedia({ order: 1 })],
            _count: { media: 2, likes: 4, comments: 3 },
          }),
        ],
        nextCursor: 'next-post',
        hasNextPage: true,
      } as never);

      const result = await postService.getUserGridPostsCursor('profile-1', 'viewer-1', { limit: 200 });

      expect(repository.findUserGridPostsCursor).toHaveBeenCalledWith('profile-1', {
        limit: 50,
        cursor: undefined,
      });
      expect(result.items.map((item) => item.previewType)).toEqual(['text', 'image', 'video', 'carousel']);
      expect(result.items[0]).toEqual(
        expect.objectContaining({
          id: 'text-post',
          contentPreview: 'themed text',
          hasContent: true,
          primaryMedia: null,
        }),
      );
      expect(result.pagination).toEqual({
        limit: 50,
        nextCursor: 'next-post',
        hasNextPage: true,
      });
      expect(feedRequestsTotal.inc).toHaveBeenCalledWith({ feed_type: 'profile_grid_cursor' });
    });

    it('loads an anchored profile feed window from the selected post', async () => {
      repository.findUserFeedWindow.mockResolvedValue({
        posts: [createFeedPost({ id: 'selected-post' }), createFeedPost({ id: 'older-post' })],
        anchorPostId: 'selected-post',
        nextCursor: 'older-post',
        hasNextPage: true,
      } as never);

      const result = await postService.getUserFeedWindow('profile-1', 'viewer-1', {
        postId: 'selected-post',
        limit: 99,
      });

      expect(repository.findUserFeedWindow).toHaveBeenCalledWith('profile-1', {
        postId: 'selected-post',
        limit: 20,
      });
      expect(result.items.map((item) => item.id)).toEqual(['selected-post', 'older-post']);
      expect(result.pagination).toEqual({
        anchorPostId: 'selected-post',
        nextCursor: 'older-post',
        hasNextPage: true,
      });
    });

    it('maps offset grid posts for fallback/simple pagination views', async () => {
      repository.findUserGridPostsOffset.mockResolvedValue({
        posts: [
          createFeedPost({
            id: 'offset-post',
            content: '  text with image  ',
            media: [createImageMedia()],
            _count: { media: 1, likes: 0, comments: 0 },
          }),
        ],
        total: 3,
      } as never);

      const result = await postService.getUserGridPostsOffset('profile-1', 'viewer-1', {
        page: 0,
        limit: 500,
      });

      expect(repository.findUserGridPostsOffset).toHaveBeenCalledWith('profile-1', {
        page: 1,
        limit: 50,
      });
      expect(result.items[0]).toEqual(
        expect.objectContaining({
          id: 'offset-post',
          hasContent: true,
          mediaCount: 1,
          primaryMedia: expect.objectContaining({
            type: 'image',
          }),
        }),
      );
      expect(result.pagination).toEqual({
        page: 1,
        limit: 50,
        total: 3,
        hasNextPage: false,
      });
      expect(feedRequestsTotal.inc).toHaveBeenCalledWith({ feed_type: 'profile_grid_offset' });
    });

    it('loads older profile feed posts after the current profile feed cursor', async () => {
      repository.findUserFeedAfter.mockResolvedValue({
        posts: [createFeedPost({ id: 'older-profile-post' })],
        nextCursor: 'older-profile-post',
        hasNextPage: false,
      } as never);

      const result = await postService.getUserFeedAfter('profile-1', 'viewer-1', {
        cursor: 'current-bottom',
        limit: 100,
      });

      expect(repository.findUserFeedAfter).toHaveBeenCalledWith('profile-1', {
        cursor: 'current-bottom',
        limit: 20,
      });
      expect(result.items[0]).toEqual(expect.objectContaining({ id: 'older-profile-post' }));
      expect(result.pagination).toEqual({
        nextCursor: 'older-profile-post',
        hasNextPage: false,
      });
      expect(feedRequestsTotal.inc).toHaveBeenCalledWith({ feed_type: 'profile_feed_after' });
    });
  });

  describe('post lifecycle', () => {
    it('updates an owned post and records the update metric', async () => {
      repository.findPostById.mockResolvedValue(createFeedPost({ authorId: 'author-1' }) as never);
      repository.updatePostAndQueuePostUpdatedEvent.mockResolvedValue(createFeedPost({ content: 'Updated' }) as never);

      const result = await postService.updatePost({ content: 'Updated' } as never, 'post-1', 'author-1');

      expect(repository.updatePostAndQueuePostUpdatedEvent).toHaveBeenCalledWith('post-1', {
        content: 'Updated',
        editedAt: expect.any(Date),
        isEdited: true,
      });
      expect(result).toEqual(expect.objectContaining({ content: 'Updated' }));
      expect(postOperationsTotal.inc).toHaveBeenCalledWith({ operation: 'update' });
    });

    it('does not update a missing post', async () => {
      repository.findPostById.mockResolvedValue(null as never);

      await expect(postService.updatePost({ content: 'Updated' } as never, 'post-1', 'author-1')).rejects.toMatchObject(
        {
          statusCode: 404,
          message: 'Post not found',
        },
      );

      expect(repository.updatePostAndQueuePostUpdatedEvent).not.toHaveBeenCalled();
    });

    it('does not update another user post', async () => {
      repository.findPostById.mockResolvedValue(createFeedPost({ authorId: 'author-2' }) as never);

      await expect(postService.updatePost({ content: 'Updated' } as never, 'post-1', 'author-1')).rejects.toMatchObject(
        {
          statusCode: 403,
          message: 'Forbidden',
        },
      );

      expect(repository.updatePostAndQueuePostUpdatedEvent).not.toHaveBeenCalled();
    });

    it('deletes an owned post and records the delete metric', async () => {
      repository.findPostById.mockResolvedValue(createFeedPost({ authorId: 'author-1' }) as never);
      repository.deletePostAndQueuePostDeletedEvent.mockResolvedValue(createFeedPost() as never);

      await expect(postService.deletePost('post-1', 'author-1')).resolves.toBeUndefined();

      expect(repository.deletePostAndQueuePostDeletedEvent).toHaveBeenCalledWith('post-1');
      expect(postOperationsTotal.inc).toHaveBeenCalledWith({ operation: 'delete' });
    });

    it('surfaces delete race when the post disappears between authorization and delete', async () => {
      repository.findPostById.mockResolvedValue(createFeedPost({ authorId: 'author-1' }) as never);
      repository.deletePostAndQueuePostDeletedEvent.mockResolvedValue(null as never);

      await expect(postService.deletePost('post-1', 'author-1')).rejects.toMatchObject({
        statusCode: 404,
        message: 'Post not found',
      });

      expect(postOperationsTotal.inc).not.toHaveBeenCalledWith({ operation: 'delete' });
    });

    it('does not delete a missing post', async () => {
      repository.findPostById.mockResolvedValue(null as never);

      await expect(postService.deletePost('post-1', 'author-1')).rejects.toMatchObject({
        statusCode: 404,
        message: 'Post not found',
      });

      expect(repository.deletePostAndQueuePostDeletedEvent).not.toHaveBeenCalled();
    });

    it('does not delete another user post', async () => {
      repository.findPostById.mockResolvedValue(createFeedPost({ authorId: 'author-2' }) as never);

      await expect(postService.deletePost('post-1', 'author-1')).rejects.toMatchObject({
        statusCode: 403,
        message: 'Forbidden',
      });

      expect(repository.deletePostAndQueuePostDeletedEvent).not.toHaveBeenCalled();
    });
  });

  describe('likes and comments', () => {
    it('likes a visible post and returns the updated like count', async () => {
      repository.findPostById.mockResolvedValue(createFeedPost() as never);
      repository.countPostLikes.mockResolvedValue(7 as never);

      const result = await postService.likePost('post-1', 'viewer-1');

      expect(repository.createPostLike).toHaveBeenCalledWith('post-1', 'viewer-1');
      expect(result).toEqual({ postId: 'post-1', liked: true, likesCount: 7 });
      expect(postEngagementActionsTotal.inc).toHaveBeenCalledWith({ action: 'like' });
    });

    it('does not like an inaccessible post', async () => {
      repository.findPostById.mockResolvedValue(createFeedPost({ authorId: 'private-user' }) as never);
      repository.canViewerAccessProfile.mockResolvedValue(false as never);

      await expect(postService.likePost('post-1', 'viewer-1')).rejects.toMatchObject({
        statusCode: 404,
        message: 'Post not found',
      });

      expect(repository.createPostLike).not.toHaveBeenCalled();
    });

    it('does not like a missing post', async () => {
      repository.findPostById.mockResolvedValue(null as never);

      await expect(postService.likePost('post-1', 'viewer-1')).rejects.toMatchObject({
        statusCode: 404,
        message: 'Post not found',
      });

      expect(repository.canViewerAccessProfile).not.toHaveBeenCalled();
      expect(repository.createPostLike).not.toHaveBeenCalled();
    });

    it('unlikes a visible post and returns the updated like count', async () => {
      repository.findPostById.mockResolvedValue(createFeedPost() as never);
      repository.countPostLikes.mockResolvedValue(2 as never);

      const result = await postService.unlikePost('post-1', 'viewer-1');

      expect(repository.deletePostLike).toHaveBeenCalledWith('post-1', 'viewer-1');
      expect(result).toEqual({ postId: 'post-1', liked: false, likesCount: 2 });
      expect(postEngagementActionsTotal.inc).toHaveBeenCalledWith({ action: 'unlike' });
    });

    it('creates a trimmed comment and falls back to unknown author when profile cache is missing', async () => {
      repository.findPostById.mockResolvedValue(createFeedPost() as never);
      repository.createPostComment.mockResolvedValue(createComment({ authorId: 'viewer-1' }) as never);
      repository.findUserProfileCacheByIds.mockResolvedValue([] as never);

      const result = await postService.createPostComment('post-1', 'viewer-1', '  Nice post  ');

      expect(repository.createPostComment).toHaveBeenCalledWith('post-1', 'viewer-1', 'Nice post');
      expect(result).toEqual({
        id: 'comment-1',
        postId: 'post-1',
        author: {
          userId: 'viewer-1',
          username: 'unknown_user',
          displayName: 'Unknown User',
          avatarUrl: null,
          status: 'unknown',
        },
        content: 'Nice post',
        createdAt: testCreatedAt,
        updatedAt: testUpdatedAt,
      });
      expect(postEngagementActionsTotal.inc).toHaveBeenCalledWith({ action: 'comment_create' });
    });

    it('lists post likes with profile summaries and unknown-user fallback', async () => {
      repository.findPostById.mockResolvedValue(createFeedPost() as never);
      repository.findPostLikes.mockResolvedValue({
        likes: [
          { userId: 'active-user', createdAt: testCreatedAt },
          { userId: 'missing-user', createdAt: testUpdatedAt },
        ],
        nextCursor: 'missing-user',
        hasNextPage: true,
      } as never);
      repository.findUserProfileCacheByIds.mockResolvedValue([
        createProfileCache({
          userId: 'active-user',
          username: 'active_user',
          displayName: null,
          avatarUrl: null,
          status: 'active',
        }),
      ] as never);

      const result = await postService.getPostLikes('post-1', 'viewer-1', {
        limit: 999,
        cursor: 'cursor-user',
      });

      expect(repository.findPostLikes).toHaveBeenCalledWith('post-1', {
        cursor: 'cursor-user',
        limit: 50,
      });
      expect(repository.findUserProfileCacheByIds).toHaveBeenCalledWith(['active-user', 'missing-user']);
      expect(result).toEqual({
        items: [
          {
            userId: 'active-user',
            username: 'active_user',
            displayName: null,
            avatarUrl: null,
            status: 'active',
            likedAt: testCreatedAt,
          },
          {
            userId: 'missing-user',
            username: 'unknown_user',
            displayName: 'Unknown User',
            avatarUrl: null,
            status: undefined,
            likedAt: testUpdatedAt,
          },
        ],
        pagination: {
          nextCursor: 'missing-user',
          hasNextPage: true,
        },
      });
    });

    it('lists post comments with author summaries and unknown-user fallback', async () => {
      repository.findPostById.mockResolvedValue(createFeedPost() as never);
      repository.findPostComments.mockResolvedValue({
        comments: [
          createComment({ id: 'comment-1', authorId: 'active-user', content: 'first' }),
          createComment({ id: 'comment-2', authorId: 'missing-user', content: 'second' }),
        ],
        nextCursor: 'comment-2',
        hasNextPage: true,
      } as never);
      repository.findUserProfileCacheByIds.mockResolvedValue([
        createProfileCache({ userId: 'active-user', username: 'active_user' }),
      ] as never);

      const result = await postService.getPostComments('post-1', 'viewer-1', {
        limit: 0,
        cursor: 'comment-cursor',
      });

      expect(repository.findPostComments).toHaveBeenCalledWith('post-1', {
        cursor: 'comment-cursor',
        limit: 20,
      });
      expect(result.items).toEqual([
        expect.objectContaining({
          id: 'comment-1',
          author: expect.objectContaining({ userId: 'active-user', username: 'active_user' }),
          content: 'first',
        }),
        expect.objectContaining({
          id: 'comment-2',
          author: {
            userId: 'missing-user',
            username: 'unknown_user',
            displayName: 'Unknown User',
            avatarUrl: null,
            status: 'unknown',
          },
          content: 'second',
        }),
      ]);
      expect(result.pagination).toEqual({
        nextCursor: 'comment-2',
        hasNextPage: true,
      });
    });

    it('lists post detail media with nullable metadata defaults', async () => {
      repository.findPostById.mockResolvedValue(createFeedPost({ id: 'post-null-media' }) as never);
      repository.findFeedPostById.mockResolvedValue(
        createFeedPost({
          id: 'post-null-media',
          media: [
            createVideoMedia({
              thumbnailUrl: undefined,
              duration: undefined,
              width: undefined,
              height: undefined,
            }),
          ],
          _count: { media: 1, likes: 0, comments: 0 },
        }) as never,
      );

      const result = await postService.getPostById('post-null-media', 'viewer-1');

      expect(result.media[0]).toEqual(
        expect.objectContaining({
          thumbnailUrl: null,
          duration: null,
          width: null,
          height: null,
        }),
      );
    });

    it('allows the comment author to delete their own comment', async () => {
      repository.findPostById.mockResolvedValue(createFeedPost({ authorId: 'post-owner' }) as never);
      repository.findCommentById.mockResolvedValue(createComment() as never);

      const result = await postService.deletePostComment('post-1', 'comment-1', 'comment-author');

      expect(repository.deleteComment).toHaveBeenCalledWith('comment-1');
      expect(result).toEqual({ postId: 'post-1', commentId: 'comment-1', deleted: true });
      expect(postEngagementActionsTotal.inc).toHaveBeenCalledWith({ action: 'comment_delete' });
    });

    it('allows the post owner to moderate comments on their post', async () => {
      repository.findPostById.mockResolvedValue(createFeedPost({ authorId: 'post-owner' }) as never);
      repository.findCommentById.mockResolvedValue(createComment() as never);

      await expect(postService.deletePostComment('post-1', 'comment-1', 'post-owner')).resolves.toEqual({
        postId: 'post-1',
        commentId: 'comment-1',
        deleted: true,
      });

      expect(repository.deleteComment).toHaveBeenCalledWith('comment-1');
    });

    it('rejects comment deletion by unrelated users', async () => {
      repository.findPostById.mockResolvedValue(createFeedPost({ authorId: 'post-owner' }) as never);
      repository.findCommentById.mockResolvedValue(createComment() as never);

      await expect(postService.deletePostComment('post-1', 'comment-1', 'viewer-1')).rejects.toMatchObject({
        statusCode: 403,
        message: 'You are not allowed to delete this comment',
      });

      expect(repository.deleteComment).not.toHaveBeenCalled();
    });

    it('rejects comment deletion when the comment belongs to another post', async () => {
      repository.findPostById.mockResolvedValue(createFeedPost({ authorId: 'post-owner' }) as never);
      repository.findCommentById.mockResolvedValue(createComment({ postId: 'other-post' }) as never);

      await expect(postService.deletePostComment('post-1', 'comment-1', 'post-owner')).rejects.toMatchObject({
        statusCode: 400,
        message: 'Comment does not belong to this post',
      });

      expect(repository.deleteComment).not.toHaveBeenCalled();
    });

    it('rejects comment deletion when the post does not exist', async () => {
      repository.findPostById.mockResolvedValue(null as never);

      await expect(postService.deletePostComment('post-1', 'comment-1', 'viewer-1')).rejects.toMatchObject({
        statusCode: 404,
        message: 'Post not found',
      });

      expect(repository.findCommentById).not.toHaveBeenCalled();
      expect(repository.deleteComment).not.toHaveBeenCalled();
    });

    it('rejects comment deletion when the comment does not exist', async () => {
      repository.findPostById.mockResolvedValue(createFeedPost({ authorId: 'post-owner' }) as never);
      repository.findCommentById.mockResolvedValue(null as never);

      await expect(postService.deletePostComment('post-1', 'comment-1', 'post-owner')).rejects.toMatchObject({
        statusCode: 404,
        message: 'Comment not found',
      });

      expect(repository.deleteComment).not.toHaveBeenCalled();
    });
  });

  describe('event and profile cache application', () => {
    it('delegates user profile cache upserts to the repository', async () => {
      const input = {
        userId: 'user-1',
        username: 'user_one',
        displayName: 'User One',
        avatarUrl: null,
        status: 'ACTIVE',
        isPrivate: false,
      };
      repository.upsertUserProfileCache.mockResolvedValue(createProfileCache(input) as never);

      const result = await postService.upsertUserProfileCache(input);

      expect(repository.upsertUserProfileCache).toHaveBeenCalledWith(input);
      expect(result).toEqual(expect.objectContaining({ userId: 'user-1' }));
    });

    it('delegates idempotent user profile events to the repository', async () => {
      const input = {
        eventId: 'event-1',
        userId: 'user-1',
        username: 'user_one',
        displayName: null,
        avatarUrl: null,
        status: 'ACTIVE',
        isPrivate: false,
      };
      repository.applyUserProfileEvent.mockResolvedValue(true as never);

      await expect(postService.applyUserProfileEvent(input)).resolves.toBe(true);
      expect(repository.applyUserProfileEvent).toHaveBeenCalledWith(input);
    });

    it('delegates active follow events to the repository', async () => {
      const input = { eventId: 'event-2', followerId: 'viewer-1', followeeId: 'author-1', isActive: true };
      repository.applyActiveFollowEvent.mockResolvedValue(false as never);

      await expect(postService.applyActiveFollowEvent(input as never)).resolves.toBe(false);
      expect(repository.applyActiveFollowEvent).toHaveBeenCalledWith(input);
    });
  });
});
