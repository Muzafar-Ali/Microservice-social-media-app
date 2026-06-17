import express from 'express';
import { PostController } from '../controllers/post.controller.js';
import validateRequestBody from '../middlewares/validaterequestBody.middleware.js';
import { createPostCommentSchema, createPostSchema, updatePostSchema } from '../validation/post.validation.js';
import isAuthenticatedRedis from '../middlewares/isAuthenticatedRedis.js';
import { rateLimitByUser } from '../middlewares/rateLimit.middleware.js';
import config from '../config/config.js';

const postRoutes = (postController: PostController) => {
  const router = express.Router();

  const feedRateLimit = rateLimitByUser({
    keyPrefix: 'feed',
    policyName: 'feed',
    message: 'Too many feed requests, please slow down',
    ...config.postRateLimits.feed,
  });

  const writeRateLimit = rateLimitByUser({
    keyPrefix: 'write',
    policyName: 'write',
    message: 'Too many post write requests, please slow down',
    ...config.postRateLimits.write,
  });

  const engagementRateLimit = rateLimitByUser({
    keyPrefix: 'engagement',
    policyName: 'engagement',
    message: 'Too many engagement requests, please slow down',
    ...config.postRateLimits.engagement,
  });

  router
    .route('/')
    .post(
      isAuthenticatedRedis,
      writeRateLimit,
      validateRequestBody(createPostSchema),
      postController.createPostHandler,
    );

  router.route('/me').get(isAuthenticatedRedis, feedRateLimit, postController.getMyPostsHandler);

  router.route('/feed/home').get(isAuthenticatedRedis, feedRateLimit, postController.getHomeFeedHandler);
  router.route('/feed/home/before').get(isAuthenticatedRedis, feedRateLimit, postController.getHomeFeedBeforeHandler);
  router.route('/feed/home/after').get(isAuthenticatedRedis, feedRateLimit, postController.getHomeFeedAfterHandler);

  // Profile browsing flow:
  // - grid/cursor renders compact profile tiles.
  // - feed/window opens the feed viewer anchored at the tapped grid post.
  // - feed/after loads older posts while scrolling down from that anchor.
  // - grid keeps an offset fallback for simple/admin pagination views.
  router
    .route('/user/:profileUserId/grid/cursor')
    .get(isAuthenticatedRedis, feedRateLimit, postController.getUserGridPostsCursorHandler);
  router
    .route('/user/:profileUserId/feed/window')
    .get(isAuthenticatedRedis, feedRateLimit, postController.getUserFeedWindowHandler);
  router
    .route('/user/:profileUserId/feed/after')
    .get(isAuthenticatedRedis, feedRateLimit, postController.getUserFeedAfterHandler);
  router
    .route('/user/:profileUserId/grid')
    .get(isAuthenticatedRedis, feedRateLimit, postController.getUserGridPostsOffsetHandler);
  router.route('/user/:profileUserId').get(isAuthenticatedRedis, feedRateLimit, postController.getPostsByUserIdHandler);

  router
    .route('/:postId/like')
    .post(isAuthenticatedRedis, engagementRateLimit, postController.likePostHandler)
    .get(isAuthenticatedRedis, feedRateLimit, postController.getPostLikesHandler)
    .delete(isAuthenticatedRedis, engagementRateLimit, postController.unlikePostHandler);

  router
    .route('/:postId/comments/:commentId')
    .delete(isAuthenticatedRedis, engagementRateLimit, postController.deletePostCommentHandler);
  router
    .route('/:postId/comments')
    .post(
      isAuthenticatedRedis,
      engagementRateLimit,
      validateRequestBody(createPostCommentSchema),
      postController.createPostCommentHandler,
    )
    .get(isAuthenticatedRedis, feedRateLimit, postController.getPostCommentsHandler);

  router
    .route('/:postId')
    .get(isAuthenticatedRedis, feedRateLimit, postController.getPostByIdHandler)
    .patch(
      isAuthenticatedRedis,
      writeRateLimit,
      validateRequestBody(updatePostSchema),
      postController.updatePostHandler,
    )
    .delete(isAuthenticatedRedis, writeRateLimit, postController.deletePostHandler);

  return router;
};

export default postRoutes;
