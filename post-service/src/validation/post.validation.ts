import { z } from 'zod';


export const postMediaItemSchema = z.object({
  type: z.enum(["image", "video"]),
  url: z.url("Media URL must be a valid URL"),
  thumbnailUrl: z.url("Thumbnail URL must be a valid URL").optional(),
  duration: z.number().int().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const createPostSchema = z.object({
  content: z.string().trim().max(2200, "Content must not exceed 2200 characters").optional(),
  themeKey: z.string().trim().min(1, "Theme key cannot be empty").optional(),
  media: z.array(postMediaItemSchema).max(5, "Maximum 5 media items are allowed'").optional().default([]),
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
});

export const updatePostSchema = z.object({
  postId: z.string().min(1, "postId is required"),
  content: z.string().trim().max(2200).optional(), // IG caption limit is ~2200 chars
}).refine((data) => data.content !== undefined, {
  message: "At least one field must be provided to update",
  path:["content"]
})

export const postIdParamsSchema = z.object({
  postId: z
    .string()
    .trim()
    .min(1, "post id param is required")
    .max(64, "invalid post id")
});

export const profileUserIdParamsSchema = z.object({
  profileUserId: z
    .string()
    .trim()
    .min(1, "post id param is required")
    .max(64, "invalid post id")
});

export const queryPaginationSchema = z.object({
  page: z.coerce.number().int("page must be an integer").min(1,"Page must be at least 1").default(1),
  limit: z.coerce.number().int("limit must be an integer").min(1, "Limit must be at least 1").max(100, "Limit cannot exceed 100").default(50)
})

export type CreatePostDto = z.infer<typeof createPostSchema>;
export type UpdatePostDto = z.infer<typeof updatePostSchema>;
export type PostParamsIdDto = z.infer<typeof postIdParamsSchema>
export type ProfileUserParamsIdDto = z.infer<typeof profileUserIdParamsSchema>
export type QueryPaginationDto = z.infer<typeof queryPaginationSchema>