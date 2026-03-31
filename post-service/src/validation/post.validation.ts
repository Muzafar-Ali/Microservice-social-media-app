import { z } from 'zod';


export const postMediaItemSchema = z.object({
  type: z.enum(["image", "video"]),
  url: z.url("Media URL must be a valid URL"),
  publicId: z
    .string()
    .trim()
    .min(1, "Public ID cannot be empty")
    .optional(),
  thumbnailUrl: z
    .url("Thumbnail URL must be a valid URL")
    .optional(),
  duration: z
    .number()
    .int()
    .positive()
    .optional(),
  width: z
    .number()
    .int()
    .positive()
    .optional(),
  height: z
    .number()
    .int()
    .positive()
    .optional(),
}).superRefine((mediaItem, ctx) => {
  
  if (mediaItem.type === "image" && mediaItem.duration !== undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["duration"],
      message: "Duration is only allowed for video media.",
    });
  }

  if (mediaItem.type === "video" && !mediaItem.thumbnailUrl) {
    ctx.addIssue({
      code: "custom",
      path: ["thumbnailUrl"],
      message: "Thumbnail URL is required for video media.",
    });
  }
});

export const createPostSchema = z.object({
  content: z
    .string()
    .trim()
    .max(2200, "Content must not exceed 2200 characters")
    .optional(),
  themeKey: z
    .string()
    .trim()
    .min(1, "Theme key cannot be empty")
    .optional(),
  media: z
    .array(postMediaItemSchema)
    .max(5, "Maximum 5 media items are allowed'")
    .optional()
    .default([]),
}).superRefine((data, ctx) => {

  const hasContent = (data.content?.trim().length ?? 0) > 0;
  const hasMedia = (data.media.length ?? 0) > 0;

  if (!hasContent && !hasMedia) {
    ctx.addIssue({
      code: 'custom',
      message: 'Post must include either content text or at least one media item.',
      path: ['content'],
    });
  }

  if (data.themeKey && hasMedia) {
    ctx.addIssue({
      code: 'custom',
      message: 'Theme key can only be used for text-only posts.',
      path: ['themeKey'],
    });
  }

  data.media.forEach((mediaItem, index) => {
    if (mediaItem.type === "video" && !mediaItem.thumbnailUrl) {
      ctx.addIssue({
        code: "custom",
        message: "Video media should include a thumbnail URL.",
        path: ["media", index, "thumbnailUrl"],
      });
    }
  });

});

export const updatePostSchema = z.object({
  postId: z
    .string()
    .min(1, "postId is required"),
  content: z
    .string()
    .trim()
    .max(2200)
    .optional(), // IG caption limit is ~2200 chars
}).refine((data) => data.content !== undefined, {
  message: "At least one field must be provided to update",
  path:["content"]
})

export const postIdParamsSchema = z.object({
  postId: z.uuid("Invalid postId"),
});

export const deletePostCommentParamsSchema = z.object({
  postId: z.uuid("Invalid postId"),
  commentId: z.uuid("Invalid commentId"),
});

export const profileUserIdParamsSchema = z.object({
  profileUserId: z
    .string()
    .trim()
    .min(1, "post id param is required")
    .max(64, "invalid post id")
});

export const queryOffsetPaginationSchema = z.object({
  page: z.coerce.number()
    .int("page must be an integer")
    .min(1,"Page must be at least 1")
    .default(1), 
  limit: z.coerce.number()
    .int("limit must be an integer")
    .min(1, "Limit must be at least 1")
    .max(100, "Limit cannot exceed 100")
    .default(50)
})

export const gridCursorPaginationSchema = z.object({
  limit: z
    .coerce.number()
    .int("limit must be an integer")
    .positive()
    .max(50, "limit can not exceed 50")
    .optional()
    .default(30),
  cursor: z
    .string()
    .trim()
    .min(1, "cursor can not be empty")
    .optional(),
});

export const likesCursorPaginationSchema = z.object({
  limit: z.coerce.number()
    .int("limit must be an integer")
    .positive()
    .max(50, "limit can not exceed 50")
    .optional()
    .default(20),
  cursor: z
    .string()
    .trim()
    .min(1, "cursor can not be empty")
    .optional(),
});

export const commentsCursorPaginationSchema = z.object({
  limit: z.coerce.number()
    .int("limit must be an integer")
    .positive()
    .max(50, "limit can not exceed 50")
    .optional()
    .default(20),
  cursor: z
    .string()
    .trim()
    .min(1, "cursor can not be empty")
    .optional(),
});

export const feedWindowQuerySchema = z.object({
  postId: z
  .string()
  .trim()
  .min(1, "Post ID is required"),
  limit: z.coerce.number()
  .int("limit must be an integer")
  .positive()
  .max(20, "limit can not exceed 20")
  .optional()
  .default(10),
});

export const feedAfterQuerySchema = z.object({
  cursor: z
    .string()
    .trim()
    .min(1, "Cursor is required"),
  limit: z.coerce.number()
    .int("limit must be an integer")
    .positive()
    .max(20, "limit can not exceed 20")
    .optional()
    .default(10),
});

export const createPostCommentSchema = z.object({
  content: z
  .string()
  .trim()
  .min(1, "Comment content is required")
  .max(1000, "Comment must not exceed 1000 characters"),
});

export type CreatePostDto = z.infer<typeof createPostSchema>;
export type UpdatePostDto = z.infer<typeof updatePostSchema>;
export type PostIdParamsDto = z.infer<typeof postIdParamsSchema>
export type DeletePostCommentParamsDto = z.infer<typeof deletePostCommentParamsSchema>
export type ProfileUserParamsIdDto = z.infer<typeof profileUserIdParamsSchema>
export type QueryPaginationDto = z.infer<typeof queryOffsetPaginationSchema>
export type QueryCursorPaginationDto = z.infer<typeof gridCursorPaginationSchema>
export type GridCursorPaginationDto = z.infer<typeof gridCursorPaginationSchema>;
export type LikesCursorPaginationDto = z.infer<typeof likesCursorPaginationSchema>;
export type FeedWindowQueryDto = z.infer<typeof feedWindowQuerySchema>;
export type FeedAfterQueryDto = z.infer<typeof feedAfterQuerySchema>;
export type CreatePostCommentDto = z.infer<typeof createPostCommentSchema>;
export type CommentsCursorPaginationDto = z.infer<typeof commentsCursorPaginationSchema>;