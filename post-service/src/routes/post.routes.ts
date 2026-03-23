import express from 'express';
import { PostController } from '../controllers/post.controller.js';
import validateRequestBody from '../middlewares/validaterequestBody.middleware.js';
import { createPostSchema, updatePostSchema } from '../validation/post.validation.js';
import isAuthenticatedRedis from '../middlewares/isAUthenticatedRedis.js';

const router = express.Router();

const postRoutes = (postController: PostController) => {

  router.route('/')
    .post(isAuthenticatedRedis, validateRequestBody(createPostSchema), postController.createPostHandler)
    .get(postController.getAllPostsHandler);
  
  router.route('/me').get(isAuthenticatedRedis, postController.getMyPostsHandler);
  router.route('/user/:profileUserId/grid/cursor').get(postController.getUserGridPostsCursorHandler); // cursor pagination end point
  router.route("/user/:profileUserId/feed/window").get(postController.getUserFeedWindowHandler);
  router.route("/user/:profileUserId/feed/after").get(postController.getUserFeedAfterHandler);
  router.route('/user/:profileUserId/grid').get(postController.getUserGridPostsOffsetHandler); // offset pagination endponit
  router.route('/user/:userId').get(postController.getPostsByUserIdHandler);

  router.route("/:postId/like").post(isAuthenticatedRedis, postController.likePostHandler);
  router.route("/:postId/unlike").delete(isAuthenticatedRedis, postController.unlikePostHandler);    
  router.route('/:postId')
    .get(postController.getPostByIdHandler)
    .patch(isAuthenticatedRedis, validateRequestBody(updatePostSchema), postController.updatePostHandler)
    .delete(isAuthenticatedRedis, postController.deletePostHandler)
  

  return router;
}

export default postRoutes;