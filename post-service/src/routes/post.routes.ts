import express from 'express';
import { PostController } from '../controllers/post.controller.js';
import isAuthenticated from '../middlewares/isAuthenticated.js';
import validateRequestBody from '../middlewares/validaterequestBody.middleware.js';
import { createPostSchema, updatePostSchema } from '../schema/post.schema.js';

const router = express.Router();

const postRoutes = (postController: PostController) => {

  router.route('/')
    .post(isAuthenticated, validateRequestBody(createPostSchema), postController.createPostHandler)
    .get(postController.getAllPostsHandler);

  router.route('/:postId')
    .get(postController.getPostByIdHandler)
    .patch(isAuthenticated, validateRequestBody(updatePostSchema), postController.updatePostHandler)
    .delete(isAuthenticated, postController.deletePostHandler)
  
  return router;
}

export default postRoutes;