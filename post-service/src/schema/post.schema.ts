import { z } from 'zod';

export const createPostSchema = z.object({
  body: z.object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters long'),
    content: z.string().trim().min(10, 'Content must be at least 10 characters long'),
    media: z.array(z.string()).optional(),
  }),
});

export const updatePostSchema = z.object({
  body: z.object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters long').optional(),
    content: z.string().trim().min(10, 'Content must be at least 10 characters long').optional(),
    media: z.array(z.string()).optional(),
  }),
});

export type CreatePostInput = z.infer<typeof createPostSchema>['body'];
export type UpdatePostInput = z.infer<typeof updatePostSchema>['body'];
