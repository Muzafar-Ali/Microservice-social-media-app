import { z } from 'zod';


export const postMediaItemSchema = z.object({
  type: z.enum(["image", "video"]),
  url: z.url(),
  thumbnailUrl: z.url().optional(),
  duration: z.number().int().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const createPostSchema = z.object({
  body: z.object({
    content: z.string().max(2200).optional().default(""),
    media: z.array(postMediaItemSchema).optional().default([]),
  }).refine(
    (data) => (data.content?.trim()?.length ?? 0) > 0 || (data.media?.length ?? 0) > 0,
    { message: "Post must include either content text or at least one media item." }
  )    
})

export const updatePostSchema = z.object({
  body: z.object({
    postId: z.string().min(1),
    content: z.string().max(2200).optional(), // IG caption limit is ~2200 chars
  }).refine((data) => data.content !== undefined, {
    message: "At least one field must be provided to update",
  })
})

export const uploadPostMediaSchema = z.object({
  body: z.object({
    secureUrl: z.url().trim().min(1, "secureUrl is required"),
    publicId: z.string().trim().min(1, "publicId is required"),
    mediaType: z.string().trim().min(1, "mediaType is required"),
    userId: z.string().trim().min(1, "userId is required"),
    postId: z.string().trim().min(1, "postId is required")
  })
})

export type CreatePostDto = z.infer<typeof createPostSchema>["body"];
export type UpdatePostDto = z.infer<typeof updatePostSchema>["body"];