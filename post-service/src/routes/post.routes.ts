import express from 'express';
import { PostController } from '../controllers/post.controller.js';
import isAuthenticated from '../middlewares/isAuthenticated.js';

const router = express.Router();

export default function postRoutes(postController: PostController) {
  router.post('/', isAuthenticated, postController.createPostHandler);
  router.get('/:id', (req, res, next) => postController.getPostByIdHandler(req, res, next));
  router.get('/', (req, res, next) => postController.getAllPostsHandler(req, res, next));
  router.put('/:id', isAuthenticated, (req, res, next) => postController.updatePostHandler(req, res, next));
  router.delete('/:id', isAuthenticated, (req, res, next) => postController.deletePostHandler(req, res, next));
  return router;
}
