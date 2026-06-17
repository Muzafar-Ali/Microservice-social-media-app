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

const createdAt = new Date('2026-01-01T10:00:00.000Z');
const updatedAt = new Date('2026-01-02T10:00:00.000Z');

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

const createProfile = (overrides: Record<string, unknown> = {}) => ({
  userId: 'author-1',
  username: 'author_one',
  displayName: 'Author One',
  avatarUrl: 'https://cdn.example.com/avatar.jpg',
  status: 'active',
  isPrivate: false,
  updatedAt,
  ...overrides,
});

const createPost = (overrides: Record<string, unknown> = {}) => ({
  id: 'post-1',
  authorId: 'author-1',
  content: 'Hello world',
  themeKey: null,
  isEdited: false,
  createdAt,
  updatedAt,
  media: [],
  _count: {
    media: 0,
    likes: 0,
    comments: 0,
  },
  ...overrides,
});

const createImageMedia = (overrides: Record<string, unknown> = {}) => ({
  id: 'media-1',
  type: MediaType.IMAGE,
  url: 'https://cdn.example.com/image.jpg',
  thumbnailUrl: null,
  duration: null,
  width: 1080,
  height: 1350,
  order: 0,
  ...overrides,
});

const createVideoMedia = (overrides: Record<string, unknown> = {}) => ({
  id: 'media-2',
  type: MediaType.VIDEO,
  url: 'https://cdn.example.com/video.mp4',
  thumbnailUrl: 'https://cdn.example.com/video-thumb.jpg',
  duration: 30,
  width: 1280,
  height: 720,
  order: 0,
  ...overrides,
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
    repository.findUserProfileCacheByIds.mockResolvedValue([createProfile()] as never);
  });

  describe('createPost', () => {
    it('creates a media post through the transactional repository and records creation metrics', async () => {
      const input = {
        content: 'Launch post',
        media: [
          {
            type: 'image',
            url: 'https://res.cloudinary.com/demo/image/upload/social-media-app/posts/images/post.jpg',
            publicId: 'social-media-app/posts/images/post',
          },
        ],
      };
      const createdPost = createPost({ content: 'Launch post' });

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
      repository.createPostAndQueuePostCreatedEvent.mockResolvedValue(createPost(input) as never);

      await postService.createPost(input as never, 'author-1');

      expect(postMediaItemsHistogram.observe).toHaveBeenCalledWith(0);
    });
  });

  describe('feeds and visibility', () => {
    it('returns home feed posts with author summary, viewer like state, pagination, and feed metrics', async () => {
      const posts = [
        createPost({
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
        posts: [createPost()],
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
      repository.findPostById.mockResolvedValue(createPost({ authorId: 'private-user' }) as never);
      repository.canViewerAccessProfile.mockResolvedValue(false as never);

      await expect(postService.getPostById('post-1', 'viewer-1')).rejects.toMatchObject({
        statusCode: 404,
        message: 'Post not found',
      });

      expect(repository.findFeedPostById).not.toHaveBeenCalled();
    });
  });

  describe('profile grid and anchored feed flow', () => {
    it('maps cursor grid posts into compact text, image, video, and carousel previews', async () => {
      repository.findUserGridPostsCursor.mockResolvedValue({
        posts: [
          createPost({ id: 'text-post', content: '   themed text   ', _count: { media: 0, likes: 1, comments: 0 } }),
          createPost({
            id: 'image-post',
            media: [createImageMedia()],
            _count: { media: 1, likes: 2, comments: 1 },
          }),
          createPost({
            id: 'video-post',
            media: [createVideoMedia()],
            _count: { media: 1, likes: 3, comments: 2 },
          }),
          createPost({
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
        posts: [createPost({ id: 'selected-post' }), createPost({ id: 'older-post' })],
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
  });

  describe('post lifecycle', () => {
    it('updates an owned post and records the update metric', async () => {
      repository.findPostById.mockResolvedValue(createPost({ authorId: 'author-1' }) as never);
      repository.updatePostAndQueuePostUpdatedEvent.mockResolvedValue(createPost({ content: 'Updated' }) as never);

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
      repository.findPostById.mockResolvedValue(createPost({ authorId: 'author-2' }) as never);

      await expect(postService.updatePost({ content: 'Updated' } as never, 'post-1', 'author-1')).rejects.toMatchObject(
        {
          statusCode: 403,
          message: 'Forbidden',
        },
      );

      expect(repository.updatePostAndQueuePostUpdatedEvent).not.toHaveBeenCalled();
    });

    it('deletes an owned post and records the delete metric', async () => {
      repository.findPostById.mockResolvedValue(createPost({ authorId: 'author-1' }) as never);
      repository.deletePostAndQueuePostDeletedEvent.mockResolvedValue(createPost() as never);

      await expect(postService.deletePost('post-1', 'author-1')).resolves.toBeUndefined();

      expect(repository.deletePostAndQueuePostDeletedEvent).toHaveBeenCalledWith('post-1');
      expect(postOperationsTotal.inc).toHaveBeenCalledWith({ operation: 'delete' });
    });

    it('surfaces delete race when the post disappears between authorization and delete', async () => {
      repository.findPostById.mockResolvedValue(createPost({ authorId: 'author-1' }) as never);
      repository.deletePostAndQueuePostDeletedEvent.mockResolvedValue(null as never);

      await expect(postService.deletePost('post-1', 'author-1')).rejects.toMatchObject({
        statusCode: 404,
        message: 'Post not found',
      });

      expect(postOperationsTotal.inc).not.toHaveBeenCalledWith({ operation: 'delete' });
    });
  });

  describe('likes and comments', () => {
    it('likes a visible post and returns the updated like count', async () => {
      repository.findPostById.mockResolvedValue(createPost() as never);
      repository.countPostLikes.mockResolvedValue(7 as never);

      const result = await postService.likePost('post-1', 'viewer-1');

      expect(repository.createPostLike).toHaveBeenCalledWith('post-1', 'viewer-1');
      expect(result).toEqual({ postId: 'post-1', liked: true, likesCount: 7 });
      expect(postEngagementActionsTotal.inc).toHaveBeenCalledWith({ action: 'like' });
    });

    it('does not like an inaccessible post', async () => {
      repository.findPostById.mockResolvedValue(createPost({ authorId: 'private-user' }) as never);
      repository.canViewerAccessProfile.mockResolvedValue(false as never);

      await expect(postService.likePost('post-1', 'viewer-1')).rejects.toMatchObject({
        statusCode: 404,
        message: 'Post not found',
      });

      expect(repository.createPostLike).not.toHaveBeenCalled();
    });

    it('creates a trimmed comment and falls back to unknown author when profile cache is missing', async () => {
      repository.findPostById.mockResolvedValue(createPost() as never);
      repository.createPostComment.mockResolvedValue({
        id: 'comment-1',
        postId: 'post-1',
        authorId: 'viewer-1',
        content: 'Nice post',
        createdAt,
        updatedAt,
      } as never);
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
        createdAt,
        updatedAt,
      });
      expect(postEngagementActionsTotal.inc).toHaveBeenCalledWith({ action: 'comment_create' });
    });

    it('allows the comment author to delete their own comment', async () => {
      repository.findPostById.mockResolvedValue(createPost({ authorId: 'post-owner' }) as never);
      repository.findCommentById.mockResolvedValue({
        id: 'comment-1',
        postId: 'post-1',
        authorId: 'comment-author',
      } as never);

      const result = await postService.deletePostComment('post-1', 'comment-1', 'comment-author');

      expect(repository.deleteComment).toHaveBeenCalledWith('comment-1');
      expect(result).toEqual({ postId: 'post-1', commentId: 'comment-1', deleted: true });
      expect(postEngagementActionsTotal.inc).toHaveBeenCalledWith({ action: 'comment_delete' });
    });

    it('allows the post owner to moderate comments on their post', async () => {
      repository.findPostById.mockResolvedValue(createPost({ authorId: 'post-owner' }) as never);
      repository.findCommentById.mockResolvedValue({
        id: 'comment-1',
        postId: 'post-1',
        authorId: 'comment-author',
      } as never);

      await expect(postService.deletePostComment('post-1', 'comment-1', 'post-owner')).resolves.toEqual({
        postId: 'post-1',
        commentId: 'comment-1',
        deleted: true,
      });

      expect(repository.deleteComment).toHaveBeenCalledWith('comment-1');
    });

    it('rejects comment deletion by unrelated users', async () => {
      repository.findPostById.mockResolvedValue(createPost({ authorId: 'post-owner' }) as never);
      repository.findCommentById.mockResolvedValue({
        id: 'comment-1',
        postId: 'post-1',
        authorId: 'comment-author',
      } as never);

      await expect(postService.deletePostComment('post-1', 'comment-1', 'viewer-1')).rejects.toMatchObject({
        statusCode: 403,
        message: 'You are not allowed to delete this comment',
      });

      expect(repository.deleteComment).not.toHaveBeenCalled();
    });

    it('rejects comment deletion when the comment belongs to another post', async () => {
      repository.findPostById.mockResolvedValue(createPost({ authorId: 'post-owner' }) as never);
      repository.findCommentById.mockResolvedValue({
        id: 'comment-1',
        postId: 'other-post',
        authorId: 'comment-author',
      } as never);

      await expect(postService.deletePostComment('post-1', 'comment-1', 'post-owner')).rejects.toMatchObject({
        statusCode: 400,
        message: 'Comment does not belong to this post',
      });

      expect(repository.deleteComment).not.toHaveBeenCalled();
    });
  });
});