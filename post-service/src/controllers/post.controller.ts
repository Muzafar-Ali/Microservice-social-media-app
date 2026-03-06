import { NextFunction, Request, Response } from 'express';
import { PostService } from '../services/post.service.js';
import { 
  CreatePostDto,  
  postIdParamsSchema,  
  PostParamsIdDto,  
  profileUserIdParamsSchema,  
  ProfileUserParamsIdDto,  
  QueryPaginationDto, 
  queryPaginationSchema, 
  UpdatePostDto, 
  updatePostSchema, 

} from '../validation/post.validation.js';
import formatZodError from '../utils/formatZodError.js';
import logger from '../utils/logger.js';
import ApiErrorHandler from '../utils/apiErrorHanlderClass.js';

export class PostController {
  constructor(private postService: PostService) {}

  /**
   * @desc    Create a new post
   * @route   POST /api/post
   * @access  Private
   */
  async createPostHandler( req: Request<Record<string, never>, any, CreatePostDto>, res: Response, next: NextFunction) {
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

  /**
   * @desc    Get a single post by ID
   * @route   GET /api/post/:postId
   * @access  Public
   */
  async getPostByIdHandler(req: Request<PostParamsIdDto>, res: Response, next: NextFunction) {
    try {
      const safeParams = postIdParamsSchema.safeParse(req.params);
      if(!safeParams.success) {
        const erroMessages = formatZodError(safeParams.error);
        throw new ApiErrorHandler(400, erroMessages);
      }

      const post = await this.postService.getPostById(safeParams.data.postId);
      if (!post) {
        throw new ApiErrorHandler(404, 'Post not found');
      }

      res.status(200).json({ 
        success: true, 
        data: post 
      });
    } catch (error) {
      logger.error(error, 'Error in getPostByIdHandler');
      next(error);
    }
  }

  /**
   * @desc    Get all posts with pagination
   * @route   GET /api/post?page=1&limit=10
   * @access  Public
   */
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

  /**
   * @desc    Get posts by user ID
   * @route   GET /api/post/user/:userId
   * @access  Public
   */
  async getPostsByUserIdHandler(req: Request<ProfileUserParamsIdDto>, res: Response, next: NextFunction) {
    try {
      
      const safeParams = profileUserIdParamsSchema.safeParse(req.params);

      if(!safeParams.success) {
        const erroMessages = formatZodError(safeParams.error);
        throw new ApiErrorHandler(400, erroMessages);
      }

      const posts = await this.postService.getPostsByUserId(safeParams.data.profileUserId);

      res.status(200).json({
        success: true,
        data: posts
      })

    } catch (error) {
      logger.error(error, 'Error in getPostByUserIdHandler');
      return next(error)
    }
  }



  /**
   * @desc    Update a post
   * @route   PATCH /api/post/:postId
   * @access  Private (Owner only)
   */
  async updatePostHandler(req: Request<PostParamsIdDto, any, UpdatePostDto>, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const { userId } = req;
      
      const safeParams = postIdParamsSchema.safeParse(req.params);

      if (!safeParams.success) {
        throw new ApiErrorHandler(400, formatZodError(safeParams.error));
      }
      
      if (!userId) {
        throw new ApiErrorHandler(401, 'Unauthorized');
      }

      // const post = await this.postService.updatePost(req.params.id, req.body, userId);

      const post = await this.postService.updatePost(data, safeParams.data.postId, userId);
      
      res.status(200).json({ 
        success: true, 
        data: post 
      });
    } catch (error) {
      logger.error(error, 'Error in updatePostHandler');
      next(error);
    }
  }

  /**
   * @desc    Delete a post
   * @route   DELETE /api/post/:postId
   * @access  Private (Owner only)
   */
  async deletePostHandler(req: Request<PostParamsIdDto>, res: Response, next: NextFunction) {
    try {
      const { userId } = req;
      if (!userId) {
        throw new ApiErrorHandler(401,'Unauthorized');
      }
      
      const safeParams = postIdParamsSchema.safeParse(req.params);
      if (!safeParams.success) {
        throw new ApiErrorHandler(400, formatZodError(safeParams.error));
      }
      

      await this.postService.deletePost(req.params.postId, userId);
      
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
