import { NextFunction, Request, Response } from 'express';
import { PostService } from '../services/post.service.js';
import { 
  CommentsCursorPaginationDto,
  commentsCursorPaginationSchema,
  CreatePostCommentDto,
  CreatePostDto,  
  DeletePostCommentParamsDto,  
  deletePostCommentParamsSchema,  
  FeedAfterQueryDto,  
  feedAfterQuerySchema,  
  FeedWindowQueryDto,  
  feedWindowQuerySchema,  
  gridCursorPaginationSchema,  
  HomeFeedQueryDto,  
  homeFeedQuerySchema,  
  LikesCursorPaginationDto,  
  likesCursorPaginationSchema,  
  PostIdParamsDto,  
  postIdParamsSchema,  
  profileUserIdParamsSchema,  
  ProfileUserParamsIdDto,  
  QueryCursorPaginationDto,  
  queryOffsetPaginationSchema,  
  QueryPaginationDto, 
  UpdatePostDto, 
} from '../validation/post.validation.js';
import formatZodError from '../utils/formatZodError.js';
import logger from '../utils/logger.js';
import ApiErrorHandler from '../utils/apiErrorHanlderClass.js';

export class PostController {
  constructor(private postService: PostService) {}

  /**
   * @desc    Create a new post for the authenticated user
   * @route   POST /api/posts
   * @access  Private (Authenticated users only)
   */
  createPostHandler = async( 
    req: Request<Record<string, never>, any, CreatePostDto>, 
    res: Response, 
    next: NextFunction
  ) => {
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
   * @desc    Retrieve a single post by its ID
   * @route   GET /api/post/:postId
   * @access  Public
   */
  getPostByIdHandler = async(
    req: Request<PostIdParamsDto>, 
    res: Response, 
    next: NextFunction
  ) => {
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
   * @desc    Get personalized home feed posts with cursor-based pagination
   * @route   GET /api/posts/feed/home?cursor=<postId>&limit=20
   * @access  Private (Authenticated User Required)
   */
  getHomeFeedHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req;

      if (!userId) {
        throw new ApiErrorHandler(401, "Unauthorized");
      }

      const safeQuery = homeFeedQuerySchema.safeParse(req.query);
      if (!safeQuery.success) {
        const errorMessages = formatZodError(safeQuery.error);
        throw new ApiErrorHandler(400, errorMessages);
      }

      const result = await this.postService.getHomeFeed(userId, {
        limit: safeQuery.data.limit,
        cursor: safeQuery.data.cursor,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error(error, "Error in getHomeFeedHandler");
      next(error);
    }
  };

  /**
   * @desc    Get all posts with pagination support
   * @route   GET /api/post?page=1&limit=10
   * @access  Public
   */
  getAllPostsHandler = async(
    req: Request<Record<string, never>, any, never, QueryPaginationDto>, 
    res: Response, 
    next: NextFunction
  ) => {
    try {
      const safeQuery = queryOffsetPaginationSchema.safeParse(req.query);

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
   * @desc    Retrieve all posts created by a specific user
   * @route   GET /api/post/user/:userId
   * @access  Public
   */
  getPostsByUserIdHandler = async(
    req: Request<ProfileUserParamsIdDto>, 
    res: Response, 
    next: NextFunction
  ) => {
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
   * @desc    Retrieve posts created by the currently logged-in user
   * @route   GET /api/post/me
   * @access  Private (Authenticated users only)
   */
  getMyPostsHandler = async(
    req: Request<{ id: string }>, 
    res: Response, 
    next: NextFunction
  ) => {
    try {
      
    } catch (error) {
      logger.error(error, 'Error in getMyPostsHandler');
      next(error);
    }
  }

  /**
   * @desc    Get profile user post grid (cursor pagination for infinite scrolling) 
   * @route   GET /api/posts/users/:profileUserId/grid?limit=50&cursor=<postId>
   * @access  Public
   */
  getUserGridPostsCursorHandler = async( 
    req: Request<ProfileUserParamsIdDto, any, never, QueryCursorPaginationDto>, 
    res: Response, 
    next: NextFunction
  ) => {
    try {
      const safeParams = profileUserIdParamsSchema.safeParse(req.params);
      if (!safeParams.success) {
        const errorMessages = formatZodError(safeParams.error);
        throw new ApiErrorHandler(400, errorMessages);
      }

      const safeQuery = gridCursorPaginationSchema.safeParse(req.query);
      if (!safeQuery.success) {
        const errorMessages = formatZodError(safeQuery.error);
        throw new ApiErrorHandler(400, errorMessages);
      }

      const result = await this.postService.getUserGridPostsCursor( safeParams.data.profileUserId, {
          limit: safeQuery.data.limit,
          cursor: safeQuery.data.cursor,
        }
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error(error, "Error in getUserGridPostsCursorHandler");
      next(error);
    }
  }

  /**
   * @desc    Get profile user grid posts (offset pagination)
   * @route   GET /api/posts/users/:profileUserId/grid?page=1&limit=50
   * @access  Public
   */
  getUserGridPostsOffsetHandler = async(
    req: Request<ProfileUserParamsIdDto, any, never, QueryPaginationDto>, 
    res: Response, 
    next: NextFunction
  ) => {
    try {

      const safeParams = profileUserIdParamsSchema.safeParse(req.params);
      if(!safeParams.success) {
        const erroMessages = formatZodError(safeParams.error);
        throw new ApiErrorHandler(400, erroMessages);
      }
      
      const safeQuery = queryOffsetPaginationSchema.safeParse(req.query);
      if(!safeQuery.success) {
        const erroMessages = formatZodError(safeQuery.error);
        throw new ApiErrorHandler(400, erroMessages);
      }

      const result = await this.postService.getUserGridPostsOffset(safeParams.data.profileUserId, {
        page: safeQuery.data.page,
        limit: safeQuery.data.limit,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
      
    } catch (error) {
      logger.error(error, 'Error in getUserGridPostsHandler');
      next(error);
    }
  }

  /**
   * @desc    Open profile user feed from a clicked post
   * @route   GET /api/posts/users/:profileUserId/feed/window?postId=<postId>&limit=10
   * @access  Public
   */
  getUserFeedWindowHandler = async (
    req: Request<ProfileUserParamsIdDto, any, never, FeedWindowQueryDto>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const safeParams = profileUserIdParamsSchema.safeParse(req.params);
      if (!safeParams.success) {
        const errorMessages = formatZodError(safeParams.error);
        throw new ApiErrorHandler(400, errorMessages);
      }

      const safeQuery = feedWindowQuerySchema.safeParse(req.query);
      if (!safeQuery.success) {
        const errorMessages = formatZodError(safeQuery.error);
        throw new ApiErrorHandler(400, errorMessages);
      }

      const result = await this.postService.getUserFeedWindow(
        safeParams.data.profileUserId,
        {
          postId: safeQuery.data.postId,
          limit: safeQuery.data.limit,
        }
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error(error, "Error in getUserFeedWindowHandler");
      return next(error);
    }
  }

  /**
 * @desc    Load older profile user feed posts after current bottom cursor
 * @route   GET /api/posts/user/:profileUserId/feed/after?cursor=<postId>&limit=10
 * @access  Public
 */
  async getUserFeedAfterHandler(
    req: Request<ProfileUserParamsIdDto, any, never, FeedAfterQueryDto>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const safeParams = profileUserIdParamsSchema.safeParse(req.params);
      if (!safeParams.success) {
        const errorMessages = formatZodError(safeParams.error);
        throw new ApiErrorHandler(400, errorMessages);
      }

      const safeQuery = feedAfterQuerySchema.safeParse(req.query);
      if (!safeQuery.success) {
        const errorMessages = formatZodError(safeQuery.error);
        throw new ApiErrorHandler(400, errorMessages);
      }

      const result = await this.postService.getUserFeedAfter(
        safeParams.data.profileUserId,
        {
          cursor: safeQuery.data.cursor,
          limit: safeQuery.data.limit,
        }
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error(error, "Error in getUserFeedAfterHandler");
      return next(error);
    }
  }

  /**
   * @desc    Update a post
   * @route   PATCH /api/post/:postId
   * @access  Private (Owner only)
   */
  updatePostHandler = async(
    req: Request<PostIdParamsDto, any, UpdatePostDto>, 
    res: Response, 
    next: NextFunction
  ) => {
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
  deletePostHandler = async(
    req: Request<PostIdParamsDto>, 
    res: Response, 
    next: NextFunction
  ) => {
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

  /**
   * @desc    Like a post
   * @route   POST /api/posts/:postId/like
   * @access  Private
   */
  likePostHandler = async (
    req: Request<PostIdParamsDto>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const safeParams = postIdParamsSchema.safeParse(req.params);
      if (!safeParams.success) {
        const errorMessages = formatZodError(safeParams.error);
        throw new ApiErrorHandler(400, errorMessages);
      }

      const { userId } = req;
      if (!userId) {
        throw new ApiErrorHandler(401, "Unauthorized");
      }

      const result = await this.postService.likePost(safeParams.data.postId, userId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error(error, "Error in likePostHandler");
      return next(error);
    }
  }

  /**
   * @desc    Unlike a post
   * @route   DELETE /api/posts/:postId/unlike
   * @access  Private
   */
  unlikePostHandler = async (
    req: Request<PostIdParamsDto>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const safeParams = postIdParamsSchema.safeParse(req.params);
      if (!safeParams.success) {
        const errorMessages = formatZodError(safeParams.error);
        throw new ApiErrorHandler(400, errorMessages);
      }

      const { userId } = req;
      if (!userId) {
        throw new ApiErrorHandler(401, "Unauthorized");
      }

      const result = await this.postService.unlikePost(safeParams.data.postId, userId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error(error, "Error in unlikePostHandler");
      return next(error);
    }
  }

  /**
   * @desc    Get users who liked a post
   * @route   GET /api/posts/:postId/likes?cursor=<userId>&limit=20
   * @access  Public
   */
  getPostLikesHandler = async (
    req: Request<PostIdParamsDto, any, never, LikesCursorPaginationDto>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const safeParams = postIdParamsSchema.safeParse(req.params);
      if (!safeParams.success) {
        const errorMessages = formatZodError(safeParams.error);
        throw new ApiErrorHandler(400, errorMessages);
      }

      const safeQuery = likesCursorPaginationSchema.safeParse(req.query);
      if (!safeQuery.success) {
        const errorMessages = formatZodError(safeQuery.error);
        throw new ApiErrorHandler(400, errorMessages);
      }

      const result = await this.postService.getPostLikes(safeParams.data.postId, {
        cursor: safeQuery.data.cursor,
        limit: safeQuery.data.limit,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error(error, "Error in getPostLikesHandler");
      return next(error);
    }
  }

  /**
   * @desc    Create comment on a post
   * @route   POST /api/posts/:postId/comments
   * @access  Private
   */
  createPostCommentHandler = async (
    req: Request<PostIdParamsDto, any, CreatePostCommentDto>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { content } = req.body

      const safeParams = postIdParamsSchema.safeParse(req.params);
      if (!safeParams.success) {
        const errorMessages = formatZodError(safeParams.error);
        throw new ApiErrorHandler(400, errorMessages);
      }

      const { userId } = req;
      if (!userId) {
        throw new ApiErrorHandler(401, "Unauthorized");
      }

      const result = await this.postService.createPostComment(
        safeParams.data.postId,
        userId,
        content
      );

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error(error, "Error in createPostCommentHandler");
      return next(error);
    }
  };

  /**
   * @desc    Get comments of a post
   * @route   GET /api/posts/:postId/comments?cursor=<commentId>&limit=20
   * @access  Public
   */
  getPostCommentsHandler = async (
    req: Request<PostIdParamsDto, any, never, CommentsCursorPaginationDto>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const safeParams = postIdParamsSchema.safeParse(req.params);
      if (!safeParams.success) {
        const errorMessages = formatZodError(safeParams.error);
        throw new ApiErrorHandler(400, errorMessages);
      }

      const safeQuery = commentsCursorPaginationSchema.safeParse(req.query);
      if (!safeQuery.success) {
        const errorMessages = formatZodError(safeQuery.error);
        throw new ApiErrorHandler(400, errorMessages);
      }

      const result = await this.postService.getPostComments(safeParams.data.postId, {
        cursor: safeQuery.data.cursor,
        limit: safeQuery.data.limit,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error(error, "Error in getPostCommentsHandler");
      return next(error);
    }
  };
  
  /**
   * @desc    Delete comment on a post
   * @route   DELETE /api/posts/:postId/comments/:commentId
   * @access  Private
   */
  deletePostCommentHandler = async (
    req: Request<DeletePostCommentParamsDto>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const safeParams = deletePostCommentParamsSchema.safeParse(req.params);
      if (!safeParams.success) {
        const errorMessages = formatZodError(safeParams.error);
        throw new ApiErrorHandler(400, errorMessages);
      }

      const { userId } = req;
      if (!userId) {
        throw new ApiErrorHandler(401, "Unauthorized");
      }

      const result = await this.postService.deletePostComment(
        safeParams.data.postId,
        safeParams.data.commentId,
        userId
      );

      res.status(200).json({
        success: true,
        message: "Comment deleted successfully",
        data: result,
      });
    } catch (error) {
      logger.error(error, "Error in deletePostCommentHandler");
      return next(error);
    }
  };

}
