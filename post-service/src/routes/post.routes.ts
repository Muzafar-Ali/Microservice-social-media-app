import express from 'express';
import { PostController } from '../controllers/post.controller.js';
import isAuthenticated from '../middlewares/isAuthenticated.js';

const router = express.Router();

const postRoutes = (postController: PostController) => {

  router.post('/', isAuthenticated, postController.createPostHandler);
  router.get('/:id', postController.getPostByIdHandler);
  router.get('/', postController.getAllPostsHandler);
  router.put('/:id', isAuthenticated, postController.updatePostHandler);
  router.delete('/:id', isAuthenticated, postController.deletePostHandler);
  
  return router;
}

export default postRoutes;