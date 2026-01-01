import { z } from 'zod';


export const postMediaItemSchema = z.object({
  type: z.enum(["image", "video"]),
  url: z.url(),
  thumbnailUrl: z.url().optional(),
  duration: z.number().int().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  order: z.number().int().nonnegative().optional(),
});

export const createPostSchema = z.object({
  content: z.string().max(2200).optional().default(""),
  media: z.array(postMediaItemSchema).optional().default([]),
}).refine(
  (data) => (data.content?.trim()?.length ?? 0) > 0 || (data.media?.length ?? 0) > 0,
  { message: "Post must include either content text or at least one media item." }
)

export const updatePostSchema = z.object({
  postId: z.string().min(1, "postId is required"),
  content: z.string().trim().max(2200).optional(), // IG caption limit is ~2200 chars
}).refine((data) => data.content !== undefined, {
  message: "At least one field must be provided to update",
  path:["content"]
})


export const postIdSchema = z.object({
  postId: z.string().trim().min(1, "postId param is required")
})

export type CreatePostDto = z.infer<typeof createPostSchema>;
export type UpdatePostDto = z.infer<typeof updatePostSchema>;
export type postIdDto = z.infer<typeof postIdSchema>