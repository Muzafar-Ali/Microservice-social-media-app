import { string, z } from 'zod';

export const createPostSchema = z.object({
  body: z.object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters long'),
    content: z.string().trim().min(10, 'Content must be at least 10 characters long'),
    // media: z.array(z.string()).optional(),
  }),
});

export const updatePostSchema = z.object({
  body: z.object({
    postId: z.string().trim().min(1, "postId is required").optional(),
    secureUrl: z.url().trim().optional(),
    publicId: z.string().trim().min(1, "publicId is required").optional(),
    mediaType: z.string().trim().min(1, "media type is required").optional(),
    title: z.string().trim().min(3, 'Title must be at least 3 characters long').optional(),
    content: z.string().trim().min(10, 'Content must be at least 10 characters long').optional(),
    media: z.array(
      z.object({
        type: z.enum(['image', 'video']),
        url: z.url(),
        thumbnailUrl: z.string().url().optional(),
        duration: z.number().optional(), // seconds (video)
        width: z.number().optional(),
        height: z.number().optional(),
      })
    ).optional(),
  }),
});

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
export type UploadPOstMediaDto = z.infer<typeof uploadPostMediaSchema>;
