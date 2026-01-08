import { NextFunction, Request, Response } from 'express';
import { PostService } from '../services/post.service.js';
import { CreatePostDto, createPostSchema, postIdDto, postIdSchema, UpdatePostDto, updatePostSchema } from '../schema/post.schema.js';
import formatZodError from '../utils/formatZodError.js';
import logger from '../utils/logger.js';
import ApiErrorHandler from '../utils/apiErrorHanlderClass.js';

export class PostController {
  constructor(private postService: PostService) {}

  async createPostHandler(req: Request<{}, {}, CreatePostDto>, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const { userId } = req;
      
      if (!userId) throw new ApiErrorHandler(401, 'Unauthorized')

      const post = await this.postService.createPost(data, userId);

      res.status(201).json({ 
        success: true,
        message: "post created successfuly",
        postId: post.id 
      });

    } catch (error) {
      logger.error(error, 'Error in createPostHandler');
      next(error);
    }
  }

  async getPostByIdHandler(req: Request, res: Response, next: NextFunction) {
    try {
      const post = await this.postService.getPostById(req.params.id);
      if (!post) {
        throw new ApiErrorHandler(404, 'Post not found');
      }
      res.status(200).json({ success: true, data: post });
    } catch (error) {
      logger.error(error, 'Error in getPostByIdHandler');
      next(error);
    }
  }

  async getAllPostsHandler(req: Request, res: Response, next: NextFunction) {
    try {
      const posts = await this.postService.getAllPosts();
      
      res.status(200).json({ success: true, data: posts });
    } catch (error) {
      logger.error(error, 'Error in getAllPostsHandler');
      next(error);
    }
  }

  async updatePostHandler(req: Request<postIdDto, {}, UpdatePostDto>, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const { userId } = req;
      
      const validationResult = postIdSchema.safeParse(req.params);
      
      if (!validationResult.success) {
        throw new ApiErrorHandler(400, formatZodError(validationResult.error));
      }
      
      if (!userId) {
        throw new ApiErrorHandler(401, 'Unauthorized');
      }

      // const post = await this.postService.updatePost(req.params.id, req.body, userId);

      const post = await this.postService.updatePost(data, validationResult.data.postId, userId);
      
      res.status(200).json({ 
        success: true, 
        data: post 
      });
    } catch (error) {
      logger.error(error, 'Error in updatePostHandler');
      next(error);
    }
  }

  async deletePostHandler(req: Request<{ id: string }>, res: Response, next: NextFunction) {
    try {
      const { userId } = req;
      if (!userId) {
        throw new ApiErrorHandler(401,'Unauthorized');
      }

      await this.postService.deletePost(req.params.id, userId);
      
      res.status(204).json({
        success: true,
        message: "post deleted successfuly"
      });
    } catch (error) {
      logger.error(error, 'Error in deletePostHandler');
      next(error);
    }
  }
}
