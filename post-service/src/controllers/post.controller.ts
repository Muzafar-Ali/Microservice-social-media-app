import { NextFunction, Request, Response } from 'express';
import { PostService } from '../services/post.service.js';
import { CreatePostDto, PostIdDto, postIdSchema, QueryPaginationDto, queryPaginationSchema, UpdatePostDto, updatePostSchema } from '../validation/post.validation.js';
import formatZodError from '../utils/formatZodError.js';
import logger from '../utils/logger.js';
import ApiErrorHandler from '../utils/apiErrorHanlderClass.js';

export class PostController {
  constructor(private postService: PostService) {}

  async createPostHandler(
    req: Request<Record<string, never>, any, CreatePostDto>, 
    res: Response, 
    next: NextFunction
  ) {
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

  async getPostByIdHandler(req: Request<PostIdDto>, res: Response, next: NextFunction) {
    try {
      const safeParams = postIdSchema.safeParse(req.params);

      if(!safeParams.success) {
        const erroMessages = formatZodError(safeParams.error);
        throw new ApiErrorHandler(400, erroMessages);
      }
      const post = await this.postService.getPostById(safeParams.data.postId);
      
      if (!post) {
        throw new ApiErrorHandler(404, 'Post not found');
      }
      res.status(200).json({ success: true, data: post });
    } catch (error) {
      logger.error(error, 'Error in getPostByIdHandler');
      next(error);
    }
  }

  async getAllPostsHandler(
    req: Request<Record<string, never>, any, Record<string, never>, QueryPaginationDto>, 
    res: Response, 
    next: NextFunction
  ) {
    try {
      const safeQuery = queryPaginationSchema.safeParse(req.query);

      if(!safeQuery.success) {
        const errorMessagge = formatZodError(safeQuery.error);
        throw new ApiErrorHandler(400, errorMessagge);
      }

      const { page, limit } = safeQuery.data
      const skip = (page - 1) * limit;
      
      const { posts, meta } = await this.postService.getAllPosts(page, limit, skip);
      
      res.status(200).json({ 
        success: true, 
        data: posts,
        meta
      });

    } catch (error) {
      logger.error(error, 'Error in getAllPostsHandler');
      next(error);
    }
  }

  async updatePostHandler(req: Request<PostIdDto, {}, UpdatePostDto>, res: Response, next: NextFunction) {
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

  async createTest(req: Request<{ id: string }>, res: Response, next: NextFunction) {
    res.status(200).json({
      message: "its test"
    })
  }
}
