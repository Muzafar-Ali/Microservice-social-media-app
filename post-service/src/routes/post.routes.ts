import express from 'express';
import { PostController } from '../controllers/post.controller.js';
import validateRequestBody from '../middlewares/validaterequestBody.middleware.js';
import { createPostSchema, updatePostSchema } from '../validation/post.validation.js';
import isAuthenticatedRedis from '../middlewares/isAUthenticatedRedis.js';

const router = express.Router();

const postRoutes = (postController: PostController) => {

  router.route('/')
    .post(isAuthenticatedRedis, postController.createPostHandler)
    .get(postController.getAllPostsHandler);
  
  router.route('/test').get(isAuthenticatedRedis, postController.createTest);
  router.route('/me').get(isAuthenticatedRedis, postController.getMyPostsHandler);
  router.route('/user/:profileUserId/grid').get(postController.getUserGridPostsOffsetHandler);
  router.route('/user/:profileUserId/grid/cursor').get(postController.getUserGridPostsCursorHandler);
  router.route('/user/:userId').get(postController.getPostsByUserIdHandler);

  router.route('/:postId')
    .get(postController.getPostByIdHandler)
    .patch(isAuthenticatedRedis, validateRequestBody(updatePostSchema), postController.updatePostHandler)
    .delete(isAuthenticatedRedis, postController.deletePostHandler)
  
  
  return router;
}

export default postRoutes;