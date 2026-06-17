import { jest } from '@jest/globals';
import { PostController } from '../../../src/controllers/post.controller.js';
import ApiErrorHandler from '../../../src/utils/apiErrorHandlerClass.js';

jest.mock('../../../src/utils/logger.js', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

const postId = '550e8400-e29b-41d4-a716-446655440000';
const commentId = '660e8400-e29b-41d4-a716-446655440000';
const viewerUserId = 'viewer-1';
const profileUserId = 'profile-1';

const createPostServiceMock = () => ({
  createPost: jest.fn(),
  getPostById: jest.fn(),
  getHomeFeed: jest.fn(),
  getHomeFeedBefore: jest.fn(),
  getHomeFeedAfter: jest.fn(),
  getAllPosts: jest.fn(),
  getPostsByUserId: jest.fn(),
  getMyPosts: jest.fn(),
  getUserGridPostsCursor: jest.fn(),
  getUserGridPostsOffset: jest.fn(),
  getUserFeedWindow: jest.fn(),
  getUserFeedAfter: jest.fn(),
  updatePost: jest.fn(),
  deletePost: jest.fn(),
  likePost: jest.fn(),
  unlikePost: jest.fn(),
  getPostLikes: jest.fn(),
  createPostComment: jest.fn(),
  getPostComments: jest.fn(),
  deletePostComment: jest.fn(),
});

const createResponse = () => {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  };

  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);

  return res;
};

const expectNextError = (next: jest.Mock, statusCode: number, message?: string) => {
  expect(next).toHaveBeenCalledTimes(1);
  const error = next.mock.calls[0][0] as ApiErrorHandler;
  expect(error).toMatchObject({
    statusCode,
  });
  if (message) {
    expect(error.message).toContain(message);
  }
};

describe('PostController', () => {
  let postService: ReturnType<typeof createPostServiceMock>;
  let postController: PostController;
  let res: ReturnType<typeof createResponse>;
  let next: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    postService = createPostServiceMock();
    postController = new PostController(postService as never);
    res = createResponse();
    next = jest.fn();
  });

  describe('createPostHandler', () => {
    it('creates a post for the authenticated user and returns the new post id', async () => {
      postService.createPost.mockResolvedValue({ id: postId } as never);
      const req = {
        userId: 'user-1',
        body: {
          content: 'hello',
          media: [],
        },
      };

      await postController.createPostHandler(req as never, res as never, next as never);

      expect(postService.createPost).toHaveBeenCalledWith(req.body, 'user-1');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'post created successfuly',
        postId,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated post creation before calling the service', async () => {
      await postController.createPostHandler({ body: { content: 'hello' } } as never, res as never, next as never);

      expect(postService.createPost).not.toHaveBeenCalled();
      expectNextError(next, 401, 'Unauthorized');
    });
  });

  describe('getPostByIdHandler', () => {
    it('returns a post detail for valid params and authenticated viewer', async () => {
      const post = { id: postId, content: 'hello' };
      postService.getPostById.mockResolvedValue(post as never);

      await postController.getPostByIdHandler(
        { userId: 'viewer-1', params: { postId } } as never,
        res as never,
        next as never,
      );

      expect(postService.getPostById).toHaveBeenCalledWith(postId, 'viewer-1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: post });
    });

    it('rejects invalid post ids before calling the service', async () => {
      await postController.getPostByIdHandler(
        { userId: 'viewer-1', params: { postId: 'bad-id' } } as never,
        res as never,
        next as never,
      );

      expect(postService.getPostById).not.toHaveBeenCalled();
      expectNextError(next, 400);
    });

    it('rejects unauthenticated post detail reads before validating params', async () => {
      await postController.getPostByIdHandler({ params: { postId } } as never, res as never, next as never);

      expect(postService.getPostById).not.toHaveBeenCalled();
      expectNextError(next, 401, 'Unauthorized');
    });
  });

  describe('home feed handlers', () => {
    it('passes normalized query values to the home feed service', async () => {
      const feed = { items: [], pagination: { limit: 20, nextCursor: null, hasNextPage: false } };
      postService.getHomeFeed.mockResolvedValue(feed as never);

      await postController.getHomeFeedHandler(
        { userId: 'viewer-1', query: { limit: '30', cursor: 'cursor-1' } } as never,
        res as never,
        next as never,
      );

      expect(postService.getHomeFeed).toHaveBeenCalledWith('viewer-1', {
        limit: 30,
        cursor: 'cursor-1',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: feed });
    });

    it('rejects home feed requests with excessive limit', async () => {
      await postController.getHomeFeedHandler(
        { userId: 'viewer-1', query: { limit: '51' } } as never,
        res as never,
        next as never,
      );

      expect(postService.getHomeFeed).not.toHaveBeenCalled();
      expectNextError(next, 400);
    });

    it('requires a cursor for home feed after pagination', async () => {
      await postController.getHomeFeedAfterHandler(
        { userId: 'viewer-1', query: { limit: '20' } } as never,
        res as never,
        next as never,
      );

      expect(postService.getHomeFeedAfter).not.toHaveBeenCalled();
      expectNextError(next, 400);
    });

    it('rejects unauthenticated home feed requests', async () => {
      await postController.getHomeFeedHandler({ query: {} } as never, res as never, next as never);

      expect(postService.getHomeFeed).not.toHaveBeenCalled();
      expectNextError(next, 401, 'Unauthorized');
    });

    it('loads newer home feed posts before the top cursor', async () => {
      const feed = { items: [{ id: postId }], pagination: { limit: 10, nextCursor: null, hasNextPage: false } };
      postService.getHomeFeedBefore.mockResolvedValue(feed as never);

      await postController.getHomeFeedBeforeHandler(
        { userId: viewerUserId, query: { cursor: postId, limit: '10' } } as never,
        res as never,
        next as never,
      );

      expect(postService.getHomeFeedBefore).toHaveBeenCalledWith(viewerUserId, { limit: 10, cursor: postId });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: feed });
    });

    it('rejects home feed before requests without cursor', async () => {
      await postController.getHomeFeedBeforeHandler(
        { userId: viewerUserId, query: {} } as never,
        res as never,
        next as never,
      );

      expect(postService.getHomeFeedBefore).not.toHaveBeenCalled();
      expectNextError(next, 400);
    });

    it('rejects unauthenticated home feed before requests', async () => {
      await postController.getHomeFeedBeforeHandler(
        { query: { cursor: postId } } as never,
        res as never,
        next as never,
      );

      expect(postService.getHomeFeedBefore).not.toHaveBeenCalled();
      expectNextError(next, 401, 'Unauthorized');
    });

    it('loads older home feed posts after the bottom cursor', async () => {
      const feed = { items: [{ id: postId }], pagination: { limit: 15, nextCursor: null, hasNextPage: false } };
      postService.getHomeFeedAfter.mockResolvedValue(feed as never);

      await postController.getHomeFeedAfterHandler(
        { userId: viewerUserId, query: { cursor: postId, limit: '15' } } as never,
        res as never,
        next as never,
      );

      expect(postService.getHomeFeedAfter).toHaveBeenCalledWith(viewerUserId, { limit: 15, cursor: postId });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: feed });
    });

    it('rejects unauthenticated home feed after requests', async () => {
      await postController.getHomeFeedAfterHandler(
        { query: { cursor: postId } } as never,
        res as never,
        next as never,
      );

      expect(postService.getHomeFeedAfter).not.toHaveBeenCalled();
      expectNextError(next, 401, 'Unauthorized');
    });
  });

  describe('public and user post listing handlers', () => {
    it('loads all posts with offset pagination and computed skip', async () => {
      const posts = [{ id: postId }];
      const meta = { page: 2, limit: 25, total: 1 };
      postService.getAllPosts.mockResolvedValue({ posts, meta } as never);

      await postController.getAllPostsHandler({ query: { page: '2', limit: '25' } } as never, res as never, next as never);

      expect(postService.getAllPosts).toHaveBeenCalledWith(2, 25, 25);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: posts, meta });
    });

    it('rejects invalid all-post pagination before service call', async () => {
      await postController.getAllPostsHandler({ query: { page: '0' } } as never, res as never, next as never);

      expect(postService.getAllPosts).not.toHaveBeenCalled();
      expectNextError(next, 400);
    });

    it('loads posts for a profile user with cursor pagination', async () => {
      const result = { items: [{ id: postId }], pagination: { nextCursor: null, hasNextPage: false } };
      postService.getPostsByUserId.mockResolvedValue(result as never);

      await postController.getPostsByUserIdHandler(
        { userId: viewerUserId, params: { profileUserId }, query: { limit: '20', cursor: postId } } as never,
        res as never,
        next as never,
      );

      expect(postService.getPostsByUserId).toHaveBeenCalledWith(profileUserId, viewerUserId, {
        limit: 20,
        cursor: postId,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('rejects unauthenticated profile post listing', async () => {
      await postController.getPostsByUserIdHandler(
        { params: { profileUserId }, query: {} } as never,
        res as never,
        next as never,
      );

      expect(postService.getPostsByUserId).not.toHaveBeenCalled();
      expectNextError(next, 401, 'Unauthorized');
    });

    it('rejects invalid profile post listing params', async () => {
      await postController.getPostsByUserIdHandler(
        { userId: viewerUserId, params: { profileUserId: '' }, query: {} } as never,
        res as never,
        next as never,
      );

      expect(postService.getPostsByUserId).not.toHaveBeenCalled();
      expectNextError(next, 400);
    });

    it('rejects invalid profile post listing pagination', async () => {
      await postController.getPostsByUserIdHandler(
        { userId: viewerUserId, params: { profileUserId }, query: { limit: '51' } } as never,
        res as never,
        next as never,
      );

      expect(postService.getPostsByUserId).not.toHaveBeenCalled();
      expectNextError(next, 400);
    });

    it('loads current user posts', async () => {
      const result = { items: [{ id: postId }], pagination: { nextCursor: null, hasNextPage: false } };
      postService.getMyPosts.mockResolvedValue(result as never);

      await postController.getMyPostsHandler(
        { userId: viewerUserId, query: { limit: '10' } } as never,
        res as never,
        next as never,
      );

      expect(postService.getMyPosts).toHaveBeenCalledWith(viewerUserId, { limit: 10, cursor: undefined });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('rejects invalid current user posts pagination', async () => {
      await postController.getMyPostsHandler(
        { userId: viewerUserId, query: { limit: '51' } } as never,
        res as never,
        next as never,
      );

      expect(postService.getMyPosts).not.toHaveBeenCalled();
      expectNextError(next, 400);
    });

    it('rejects unauthenticated current user posts', async () => {
      await postController.getMyPostsHandler({ query: {} } as never, res as never, next as never);

      expect(postService.getMyPosts).not.toHaveBeenCalled();
      expectNextError(next, 401, 'Unauthorized');
    });
  });

  describe('profile browsing handlers', () => {
    it('loads profile grid posts with cursor pagination', async () => {
      const grid = { items: [], pagination: { limit: 50, nextCursor: null, hasNextPage: false } };
      postService.getUserGridPostsCursor.mockResolvedValue(grid as never);

      await postController.getUserGridPostsCursorHandler(
        {
          userId: 'viewer-1',
          params: { profileUserId: 'profile-1' },
          query: { limit: '50', cursor: 'post-cursor' },
        } as never,
        res as never,
        next as never,
      );

      expect(postService.getUserGridPostsCursor).toHaveBeenCalledWith('profile-1', 'viewer-1', {
        limit: 50,
        cursor: 'post-cursor',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: grid });
    });

    it('opens profile feed window from selected post', async () => {
      const windowResult = {
        items: [{ id: postId }],
        pagination: { anchorPostId: postId, nextCursor: null, hasNextPage: false },
      };
      postService.getUserFeedWindow.mockResolvedValue(windowResult as never);

      await postController.getUserFeedWindowHandler(
        {
          userId: 'viewer-1',
          params: { profileUserId: 'profile-1' },
          query: { postId, limit: '10' },
        } as never,
        res as never,
        next as never,
      );

      expect(postService.getUserFeedWindow).toHaveBeenCalledWith('profile-1', 'viewer-1', {
        postId,
        limit: 10,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('rejects profile feed window without selected post id', async () => {
      await postController.getUserFeedWindowHandler(
        {
          userId: 'viewer-1',
          params: { profileUserId: 'profile-1' },
          query: { limit: '10' },
        } as never,
        res as never,
        next as never,
      );

      expect(postService.getUserFeedWindow).not.toHaveBeenCalled();
      expectNextError(next, 400);
    });

    it('rejects unauthenticated profile grid cursor requests', async () => {
      await postController.getUserGridPostsCursorHandler(
        { params: { profileUserId }, query: {} } as never,
        res as never,
        next as never,
      );

      expect(postService.getUserGridPostsCursor).not.toHaveBeenCalled();
      expectNextError(next, 401, 'Unauthorized');
    });

    it('rejects invalid profile grid cursor params', async () => {
      await postController.getUserGridPostsCursorHandler(
        { userId: viewerUserId, params: { profileUserId: '' }, query: {} } as never,
        res as never,
        next as never,
      );

      expect(postService.getUserGridPostsCursor).not.toHaveBeenCalled();
      expectNextError(next, 400);
    });

    it('rejects invalid profile grid cursor pagination', async () => {
      await postController.getUserGridPostsCursorHandler(
        { userId: viewerUserId, params: { profileUserId }, query: { limit: '51' } } as never,
        res as never,
        next as never,
      );

      expect(postService.getUserGridPostsCursor).not.toHaveBeenCalled();
      expectNextError(next, 400);
    });

    it('rejects unauthenticated profile grid offset requests', async () => {
      await postController.getUserGridPostsOffsetHandler(
        { params: { profileUserId }, query: {} } as never,
        res as never,
        next as never,
      );

      expect(postService.getUserGridPostsOffset).not.toHaveBeenCalled();
      expectNextError(next, 401, 'Unauthorized');
    });

    it('rejects invalid profile grid offset params', async () => {
      await postController.getUserGridPostsOffsetHandler(
        { userId: viewerUserId, params: { profileUserId: '' }, query: {} } as never,
        res as never,
        next as never,
      );

      expect(postService.getUserGridPostsOffset).not.toHaveBeenCalled();
      expectNextError(next, 400);
    });

    it('loads profile grid posts with offset pagination', async () => {
      const result = { items: [{ id: postId }], pagination: { page: 2, limit: 20 } };
      postService.getUserGridPostsOffset.mockResolvedValue(result as never);

      await postController.getUserGridPostsOffsetHandler(
        { userId: viewerUserId, params: { profileUserId }, query: { page: '2', limit: '20' } } as never,
        res as never,
        next as never,
      );

      expect(postService.getUserGridPostsOffset).toHaveBeenCalledWith(profileUserId, viewerUserId, {
        page: 2,
        limit: 20,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('rejects invalid profile grid offset pagination', async () => {
      await postController.getUserGridPostsOffsetHandler(
        { userId: viewerUserId, params: { profileUserId }, query: { limit: '101' } } as never,
        res as never,
        next as never,
      );

      expect(postService.getUserGridPostsOffset).not.toHaveBeenCalled();
      expectNextError(next, 400);
    });

    it('rejects unauthenticated profile feed window requests', async () => {
      await postController.getUserFeedWindowHandler(
        { params: { profileUserId }, query: { postId } } as never,
        res as never,
        next as never,
      );

      expect(postService.getUserFeedWindow).not.toHaveBeenCalled();
      expectNextError(next, 401, 'Unauthorized');
    });

    it('rejects invalid profile feed window params', async () => {
      await postController.getUserFeedWindowHandler(
        { userId: viewerUserId, params: { profileUserId: '' }, query: { postId } } as never,
        res as never,
        next as never,
      );

      expect(postService.getUserFeedWindow).not.toHaveBeenCalled();
      expectNextError(next, 400);
    });

    it('loads older profile feed posts after cursor', async () => {
      const result = { items: [{ id: postId }], pagination: { nextCursor: null, hasNextPage: false } };
      postService.getUserFeedAfter.mockResolvedValue(result as never);

      await postController.getUserFeedAfterHandler(
        { userId: viewerUserId, params: { profileUserId }, query: { cursor: postId, limit: '10' } } as never,
        res as never,
        next as never,
      );

      expect(postService.getUserFeedAfter).toHaveBeenCalledWith(profileUserId, viewerUserId, {
        cursor: postId,
        limit: 10,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('rejects profile feed after requests without cursor', async () => {
      await postController.getUserFeedAfterHandler(
        { userId: viewerUserId, params: { profileUserId }, query: {} } as never,
        res as never,
        next as never,
      );

      expect(postService.getUserFeedAfter).not.toHaveBeenCalled();
      expectNextError(next, 400);
    });

    it('rejects unauthenticated profile feed after requests', async () => {
      await postController.getUserFeedAfterHandler(
        { params: { profileUserId }, query: { cursor: postId } } as never,
        res as never,
        next as never,
      );

      expect(postService.getUserFeedAfter).not.toHaveBeenCalled();
      expectNextError(next, 401, 'Unauthorized');
    });

    it('rejects invalid profile feed after params', async () => {
      await postController.getUserFeedAfterHandler(
        { userId: viewerUserId, params: { profileUserId: '' }, query: { cursor: postId } } as never,
        res as never,
        next as never,
      );

      expect(postService.getUserFeedAfter).not.toHaveBeenCalled();
      expectNextError(next, 400);
    });
  });

  describe('post lifecycle handlers', () => {
    it('updates an authenticated user post', async () => {
      const updatedPost = { id: postId, content: 'updated' };
      postService.updatePost.mockResolvedValue(updatedPost as never);

      await postController.updatePostHandler(
        { userId: 'author-1', params: { postId }, body: { content: 'updated' } } as never,
        res as never,
        next as never,
      );

      expect(postService.updatePost).toHaveBeenCalledWith({ content: 'updated' }, postId, 'author-1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: updatedPost });
    });

    it('rejects update when post id param is invalid', async () => {
      await postController.updatePostHandler(
        { userId: 'author-1', params: { postId: 'bad-id' }, body: { content: 'updated' } } as never,
        res as never,
        next as never,
      );

      expect(postService.updatePost).not.toHaveBeenCalled();
      expectNextError(next, 400);
    });

    it('deletes an authenticated user post with 204 status', async () => {
      postService.deletePost.mockResolvedValue(undefined as never);

      await postController.deletePostHandler(
        { userId: 'author-1', params: { postId } } as never,
        res as never,
        next as never,
      );

      expect(postService.deletePost).toHaveBeenCalledWith(postId, 'author-1');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'post deleted successfuly',
      });
    });

    it('rejects unauthenticated updates after validating the post id', async () => {
      await postController.updatePostHandler(
        { params: { postId }, body: { content: 'updated' } } as never,
        res as never,
        next as never,
      );

      expect(postService.updatePost).not.toHaveBeenCalled();
      expectNextError(next, 401, 'Unauthorized');
    });

    it('rejects unauthenticated deletes before calling the service', async () => {
      await postController.deletePostHandler({ params: { postId } } as never, res as never, next as never);

      expect(postService.deletePost).not.toHaveBeenCalled();
      expectNextError(next, 401, 'Unauthorized');
    });

    it('rejects delete when post id param is invalid', async () => {
      await postController.deletePostHandler(
        { userId: 'author-1', params: { postId: 'bad-id' } } as never,
        res as never,
        next as never,
      );

      expect(postService.deletePost).not.toHaveBeenCalled();
      expectNextError(next, 400);
    });
  });

  describe('like handlers', () => {
    it('likes a post for an authenticated user', async () => {
      const likeResult = { postId, liked: true, likesCount: 1 };
      postService.likePost.mockResolvedValue(likeResult as never);

      await postController.likePostHandler(
        { userId: 'viewer-1', params: { postId } } as never,
        res as never,
        next as never,
      );

      expect(postService.likePost).toHaveBeenCalledWith(postId, 'viewer-1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: likeResult });
    });

    it('rejects like with invalid post id before auth-dependent service call', async () => {
      await postController.likePostHandler(
        { userId: 'viewer-1', params: { postId: 'bad-id' } } as never,
        res as never,
        next as never,
      );

      expect(postService.likePost).not.toHaveBeenCalled();
      expectNextError(next, 400);
    });

    it('lists users who liked a post with cursor pagination', async () => {
      const likes = { items: [], pagination: { nextCursor: null, hasNextPage: false } };
      postService.getPostLikes.mockResolvedValue(likes as never);

      await postController.getPostLikesHandler(
        { userId: 'viewer-1', params: { postId }, query: { cursor: 'user-cursor', limit: '25' } } as never,
        res as never,
        next as never,
      );

      expect(postService.getPostLikes).toHaveBeenCalledWith(postId, 'viewer-1', {
        cursor: 'user-cursor',
        limit: 25,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('rejects unauthenticated like requests after validating params', async () => {
      await postController.likePostHandler({ params: { postId } } as never, res as never, next as never);

      expect(postService.likePost).not.toHaveBeenCalled();
      expectNextError(next, 401, 'Unauthorized');
    });

    it('unlikes a post for an authenticated user', async () => {
      const unlikeResult = { postId, liked: false, likesCount: 0 };
      postService.unlikePost.mockResolvedValue(unlikeResult as never);

      await postController.unlikePostHandler(
        { userId: viewerUserId, params: { postId } } as never,
        res as never,
        next as never,
      );

      expect(postService.unlikePost).toHaveBeenCalledWith(postId, viewerUserId);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: unlikeResult });
    });

    it('rejects unlike with invalid post id', async () => {
      await postController.unlikePostHandler(
        { userId: viewerUserId, params: { postId: 'bad-id' } } as never,
        res as never,
        next as never,
      );

      expect(postService.unlikePost).not.toHaveBeenCalled();
      expectNextError(next, 400);
    });

    it('rejects unauthenticated unlike requests after validating params', async () => {
      await postController.unlikePostHandler({ params: { postId } } as never, res as never, next as never);

      expect(postService.unlikePost).not.toHaveBeenCalled();
      expectNextError(next, 401, 'Unauthorized');
    });

    it('rejects unauthenticated post like listing', async () => {
      await postController.getPostLikesHandler({ params: { postId }, query: {} } as never, res as never, next as never);

      expect(postService.getPostLikes).not.toHaveBeenCalled();
      expectNextError(next, 401, 'Unauthorized');
    });

    it('rejects post like listing with invalid post id', async () => {
      await postController.getPostLikesHandler(
        { userId: viewerUserId, params: { postId: 'bad-id' }, query: {} } as never,
        res as never,
        next as never,
      );

      expect(postService.getPostLikes).not.toHaveBeenCalled();
      expectNextError(next, 400);
    });

    it('rejects post like listing with invalid pagination', async () => {
      await postController.getPostLikesHandler(
        { userId: viewerUserId, params: { postId }, query: { limit: '51' } } as never,
        res as never,
        next as never,
      );

      expect(postService.getPostLikes).not.toHaveBeenCalled();
      expectNextError(next, 400);
    });
  });

  describe('comment handlers', () => {
    it('creates a comment for an authenticated user', async () => {
      const comment = { id: commentId, postId, content: 'nice' };
      postService.createPostComment.mockResolvedValue(comment as never);

      await postController.createPostCommentHandler(
        { userId: 'viewer-1', params: { postId }, body: { content: 'nice' } } as never,
        res as never,
        next as never,
      );

      expect(postService.createPostComment).toHaveBeenCalledWith(postId, 'viewer-1', 'nice');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: comment });
    });

    it('rejects comment creation with invalid post id', async () => {
      await postController.createPostCommentHandler(
        { userId: 'viewer-1', params: { postId: 'bad-id' }, body: { content: 'nice' } } as never,
        res as never,
        next as never,
      );

      expect(postService.createPostComment).not.toHaveBeenCalled();
      expectNextError(next, 400);
    });

    it('deletes a comment with validated post and comment ids', async () => {
      const deleteResult = { postId, commentId, deleted: true };
      postService.deletePostComment.mockResolvedValue(deleteResult as never);

      await postController.deletePostCommentHandler(
        { userId: 'viewer-1', params: { postId, commentId } } as never,
        res as never,
        next as never,
      );

      expect(postService.deletePostComment).toHaveBeenCalledWith(postId, commentId, 'viewer-1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Comment deleted successfully',
        data: deleteResult,
      });
    });

    it('rejects unauthenticated comment creation before validation-dependent service call', async () => {
      await postController.createPostCommentHandler(
        { params: { postId }, body: { content: 'nice' } } as never,
        res as never,
        next as never,
      );

      expect(postService.createPostComment).not.toHaveBeenCalled();
      expectNextError(next, 401, 'Unauthorized');
    });

    it('lists comments with cursor pagination', async () => {
      const comments = { items: [{ id: commentId }], pagination: { nextCursor: null, hasNextPage: false } };
      postService.getPostComments.mockResolvedValue(comments as never);

      await postController.getPostCommentsHandler(
        { userId: viewerUserId, params: { postId }, query: { cursor: commentId, limit: '20' } } as never,
        res as never,
        next as never,
      );

      expect(postService.getPostComments).toHaveBeenCalledWith(postId, viewerUserId, {
        cursor: commentId,
        limit: 20,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: comments });
    });

    it('rejects unauthenticated comment listing', async () => {
      await postController.getPostCommentsHandler(
        { params: { postId }, query: {} } as never,
        res as never,
        next as never,
      );

      expect(postService.getPostComments).not.toHaveBeenCalled();
      expectNextError(next, 401, 'Unauthorized');
    });

    it('rejects comment listing with invalid post id', async () => {
      await postController.getPostCommentsHandler(
        { userId: viewerUserId, params: { postId: 'bad-id' }, query: {} } as never,
        res as never,
        next as never,
      );

      expect(postService.getPostComments).not.toHaveBeenCalled();
      expectNextError(next, 400);
    });

    it('rejects comment listing with invalid pagination', async () => {
      await postController.getPostCommentsHandler(
        { userId: viewerUserId, params: { postId }, query: { limit: '51' } } as never,
        res as never,
        next as never,
      );

      expect(postService.getPostComments).not.toHaveBeenCalled();
      expectNextError(next, 400);
    });

    it('rejects comment delete with invalid params', async () => {
      await postController.deletePostCommentHandler(
        { userId: viewerUserId, params: { postId: 'bad-id', commentId } } as never,
        res as never,
        next as never,
      );

      expect(postService.deletePostComment).not.toHaveBeenCalled();
      expectNextError(next, 400);
    });

    it('rejects unauthenticated comment delete after validating params', async () => {
      await postController.deletePostCommentHandler(
        { params: { postId, commentId } } as never,
        res as never,
        next as never,
      );

      expect(postService.deletePostComment).not.toHaveBeenCalled();
      expectNextError(next, 401, 'Unauthorized');
    });
  });
});
