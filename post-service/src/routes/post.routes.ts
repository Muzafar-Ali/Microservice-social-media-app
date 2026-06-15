import express from 'express';
import { PostController } from '../controllers/post.controller.js';
import validateRequestBody from '../middlewares/validaterequestBody.middleware.js';
import { createPostCommentSchema, createPostSchema, updatePostSchema } from '../validation/post.validation.js';
import isAuthenticatedRedis from '../middlewares/isAuthenticatedRedis.js';

const postRoutes = (postController: PostController) => {
  const router = express.Router();

  router.route('/').post(isAuthenticatedRedis, validateRequestBody(createPostSchema), postController.createPostHandler);

  router.route('/me').get(isAuthenticatedRedis, postController.getMyPostsHandler);

  router.route('/feed/home').get(isAuthenticatedRedis, postController.getHomeFeedHandler);
  router.route('/feed/home/before').get(isAuthenticatedRedis, postController.getHomeFeedBeforeHandler);
  router.route('/feed/home/after').get(isAuthenticatedRedis, postController.getHomeFeedAfterHandler);

  router
    .route('/user/:profileUserId/grid/cursor')
    .get(isAuthenticatedRedis, postController.getUserGridPostsCursorHandler);
  router.route('/user/:profileUserId/feed/window').get(isAuthenticatedRedis, postController.getUserFeedWindowHandler);
  router.route('/user/:profileUserId/feed/after').get(isAuthenticatedRedis, postController.getUserFeedAfterHandler);
  router.route('/user/:profileUserId/grid').get(isAuthenticatedRedis, postController.getUserGridPostsOffsetHandler);
  router.route('/user/:profileUserId').get(isAuthenticatedRedis, postController.getPostsByUserIdHandler);

  router
    .route('/:postId/like')
    .post(isAuthenticatedRedis, postController.likePostHandler)
    .get(isAuthenticatedRedis, postController.getPostLikesHandler)
    .delete(isAuthenticatedRedis, postController.unlikePostHandler);

  router.route('/:postId/comments/:commentId').delete(isAuthenticatedRedis, postController.deletePostCommentHandler);
  router
    .route('/:postId/comments')
    .post(isAuthenticatedRedis, validateRequestBody(createPostCommentSchema), postController.createPostCommentHandler)
    .get(isAuthenticatedRedis, postController.getPostCommentsHandler);

  router
    .route('/:postId')
    .get(isAuthenticatedRedis, postController.getPostByIdHandler)
    .patch(isAuthenticatedRedis, validateRequestBody(updatePostSchema), postController.updatePostHandler)
    .delete(isAuthenticatedRedis, postController.deletePostHandler);

  return router;
};

export default postRoutes;
