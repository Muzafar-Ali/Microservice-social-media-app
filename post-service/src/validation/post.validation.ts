import { z } from 'zod';

const POST_IMAGE_PUBLIC_ID_PREFIX = 'social-media-app/posts/images/';
const POST_VIDEO_PUBLIC_ID_PREFIX = 'social-media-app/posts/videos/';

export const postMediaItemSchema = z
  .object({
    type: z.enum(['image', 'video']),
    url: z.url('Media URL must be a valid URL'),
    publicId: z.string().trim().min(1, 'Public ID is required'),
    thumbnailUrl: z.url('Thumbnail URL must be a valid URL').optional(),
    duration: z.number().int().positive().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  })
  .superRefine((mediaItem, ctx) => {
    if (!mediaItem.url.startsWith('https://')) {
      ctx.addIssue({
        code: 'custom',
        path: ['url'],
        message: 'Media URL must use HTTPS.',
      });
    }

    if (mediaItem.thumbnailUrl && !mediaItem.thumbnailUrl.startsWith('https://')) {
      ctx.addIssue({
        code: 'custom',
        path: ['thumbnailUrl'],
        message: 'Thumbnail URL must use HTTPS.',
      });
    }

    const expectedPublicIdPrefix =
      mediaItem.type === 'image' ? POST_IMAGE_PUBLIC_ID_PREFIX : POST_VIDEO_PUBLIC_ID_PREFIX;

    if (!mediaItem.publicId.startsWith(expectedPublicIdPrefix)) {
      ctx.addIssue({
        code: 'custom',
        path: ['publicId'],
        message: 'Media public ID is not allowed for this media type.',
      });
    }

    if (mediaItem.type === 'image' && mediaItem.duration !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['duration'],
        message: 'Duration is only allowed for video media.',
      });
    }

    if (mediaItem.type === 'video' && !mediaItem.thumbnailUrl) {
      ctx.addIssue({
        code: 'custom',
        path: ['thumbnailUrl'],
        message: 'Thumbnail URL is required for video media.',
      });
    }
  });

export const createPostSchema = z
  .object({
    content: z.string().trim().max(2200, 'Content must not exceed 2200 characters').optional(),
    themeKey: z.string().trim().min(1, 'Theme key cannot be empty').optional(),
    media: z.array(postMediaItemSchema).max(5, "Maximum 5 media items are allowed'").optional().default([]),
  })
  .superRefine((data, ctx) => {
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
      if (mediaItem.type === 'video' && !mediaItem.thumbnailUrl) {
        ctx.addIssue({
          code: 'custom',
          message: 'Video media should include a thumbnail URL.',
          path: ['media', index, 'thumbnailUrl'],
        });
      }
    });
  });

export const updatePostSchema = z
  .object({
    content: z.string().trim().max(2200).optional(), // IG caption limit is ~2200 chars
  })
  .refine((data) => data.content !== undefined, {
    message: 'At least one field must be provided to update',
    path: ['content'],
  });

export const postIdParamsSchema = z.object({
  postId: z.uuid('Invalid postId'),
});

export const deletePostCommentParamsSchema = z.object({
  postId: z.uuid('Invalid postId'),
  commentId: z.uuid('Invalid commentId'),
});

export const profileUserIdParamsSchema = z.object({
  profileUserId: z.string().trim().min(1, 'post id param is required').max(64, 'invalid post id'),
});

export const queryOffsetPaginationSchema = z.object({
  page: z.coerce.number().int('page must be an integer').min(1, 'Page must be at least 1').default(1),
  limit: z.coerce
    .number()
    .int('limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(50),
});

export const gridCursorPaginationSchema = z.object({
  limit: z.coerce
    .number()
    .int('limit must be an integer')
    .positive()
    .max(50, 'limit can not exceed 50')
    .optional()
    .default(30),
  cursor: z.string().trim().min(1, 'cursor can not be empty').optional(),
});

export const likesCursorPaginationSchema = z.object({
  limit: z.coerce
    .number()
    .int('limit must be an integer')
    .positive()
    .max(50, 'limit can not exceed 50')
    .optional()
    .default(20),
  cursor: z.string().trim().min(1, 'cursor can not be empty').optional(),
});

export const commentsCursorPaginationSchema = z.object({
  limit: z.coerce
    .number()
    .int('limit must be an integer')
    .positive()
    .max(50, 'limit can not exceed 50')
    .optional()
    .default(20),
  cursor: z.string().trim().min(1, 'cursor can not be empty').optional(),
});

export const feedWindowQuerySchema = z.object({
  postId: z.string().trim().min(1, 'Post ID is required'),
  limit: z.coerce
    .number()
    .int('limit must be an integer')
    .positive()
    .max(20, 'limit can not exceed 20')
    .optional()
    .default(10),
});

export const feedAfterQuerySchema = z.object({
  cursor: z.string().trim().min(1, 'Cursor is required'),
  limit: z.coerce
    .number()
    .int('limit must be an integer')
    .positive()
    .max(20, 'limit can not exceed 20')
    .optional()
    .default(10),
});

export const homeFeedQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int('limit must be an integer')
    .positive()
    .max(50, 'limit can not exceed 50')
    .optional()
    .default(20),
  cursor: z.string().trim().min(1, 'cursor can not be empty').optional(),
});

export const homeFeedBeforeQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int('limit must be an integer')
    .positive()
    .max(50, 'limit can not exceed 50')
    .optional()
    .default(20),
  cursor: z.string().trim().min(1, 'cursor is required'),
});

export const homeFeedAfterQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int('limit must be an integer')
    .positive()
    .max(50, 'limit can not exceed 50')
    .optional()
    .default(20),
  cursor: z.string().trim().min(1, 'cursor is required'),
});

export const createPostCommentSchema = z.object({
  content: z.string().trim().min(1, 'Comment content is required').max(1000, 'Comment must not exceed 1000 characters'),
});

export const userCreatedPayloadSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  displayName: z.string().nullable(),
  profileImage: z
    .object({
      secureUrl: z.url(),
      publicId: z.string().min(1),
    })
    .nullable(),
  status: z.string().min(1),
  isPrivate: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

export const userCreatedEventSchema = z.object({
  eventId: z.string().min(1),
  eventName: z.literal('user.created'),
  eventVersion: z.number().int().positive(),
  occurredAt: z.string().datetime(),
  producerService: z.string().min(1),
  partitionKey: z.string().min(1),
  data: userCreatedPayloadSchema,
});

export const userUpdatedPayloadSchema = z.object({
  userId: z.string().min(1, { error: 'userId is required' }),
  username: z.string().min(1, { error: 'username is required' }),
  displayName: z.string().nullable(),
  profileImage: z
    .object({
      secureUrl: z.url({ error: 'secureUrl must be a valid URL' }),
      publicId: z.string().min(1, { error: 'publicId is required' }),
    })
    .nullable(),
  status: z.string().min(1, { error: 'status is required' }),
  isPrivate: z.boolean(),
  updatedAt: z.iso.datetime({ error: 'updatedAt must be a valid ISO datetime' }),
});

export const userUpdatedEventSchema = z.object({
  eventId: z.string().min(1, { error: 'eventId is required' }),
  eventName: z.literal('user.updated'),
  eventVersion: z.number().int().positive(),
  occurredAt: z.iso.datetime({ error: 'occurredAt must be a valid ISO datetime' }),
  producerService: z.string().min(1, { error: 'producerService is required' }),
  partitionKey: z.string().min(1, { error: 'partitionKey is required' }),
  data: userUpdatedPayloadSchema,
});

const activeFollowPayloadSchema = z.object({
  followerId: z.uuid({ error: 'followerId must be a valid UUID' }),
  followeeId: z.uuid({ error: 'followeeId must be a valid UUID' }),
});

export const activeFollowCreatedEventSchema = z.object({
  eventId: z.string().min(1, { error: 'eventId is required' }),
  eventName: z.union([z.literal('follow.created'), z.literal('follow.accepted')]),
  eventVersion: z.number().int().positive(),
  occurredAt: z.iso.datetime({ error: 'occurredAt must be a valid ISO datetime' }),
  producerService: z.string().min(1, { error: 'producerService is required' }),
  partitionKey: z.string().min(1, { error: 'partitionKey is required' }),
  data: activeFollowPayloadSchema.extend({
    status: z.literal('ACTIVE'),
    createdAt: z.iso.datetime({ error: 'createdAt must be a valid ISO datetime' }),
  }),
});

export const activeFollowRemovedEventSchema = z.object({
  eventId: z.string().min(1, { error: 'eventId is required' }),
  eventName: z.literal('follow.removed'),
  eventVersion: z.number().int().positive(),
  occurredAt: z.iso.datetime({ error: 'occurredAt must be a valid ISO datetime' }),
  producerService: z.string().min(1, { error: 'producerService is required' }),
  partitionKey: z.string().min(1, { error: 'partitionKey is required' }),
  data: activeFollowPayloadSchema.extend({
    removedAt: z.iso.datetime({ error: 'removedAt must be a valid ISO datetime' }),
  }),
});

export type CreatePostDto = z.infer<typeof createPostSchema>;
export type UpdatePostDto = z.infer<typeof updatePostSchema>;
export type PostIdParamsDto = z.infer<typeof postIdParamsSchema>;
export type DeletePostCommentParamsDto = z.infer<typeof deletePostCommentParamsSchema>;
export type ProfileUserParamsIdDto = z.infer<typeof profileUserIdParamsSchema>;
export type QueryPaginationDto = z.infer<typeof queryOffsetPaginationSchema>;
export type QueryCursorPaginationDto = z.infer<typeof gridCursorPaginationSchema>;
export type GridCursorPaginationDto = z.infer<typeof gridCursorPaginationSchema>;
export type LikesCursorPaginationDto = z.infer<typeof likesCursorPaginationSchema>;
export type FeedWindowQueryDto = z.infer<typeof feedWindowQuerySchema>;
export type FeedAfterQueryDto = z.infer<typeof feedAfterQuerySchema>;
export type CreatePostCommentDto = z.infer<typeof createPostCommentSchema>;
export type CommentsCursorPaginationDto = z.infer<typeof commentsCursorPaginationSchema>;
export type HomeFeedQueryDto = z.infer<typeof homeFeedQuerySchema>;
export type HomeFeedBeforeQueryDto = z.infer<typeof homeFeedBeforeQuerySchema>;
export type HomeFeedAfterQueryDto = z.infer<typeof homeFeedAfterQuerySchema>;
export type UserCreatedEvent = z.infer<typeof userCreatedEventSchema>;
export type UserUpdatedEvent = z.infer<typeof userUpdatedEventSchema>;
export type ActiveFollowCreatedEvent = z.infer<typeof activeFollowCreatedEventSchema>;
export type ActiveFollowRemovedEvent = z.infer<typeof activeFollowRemovedEventSchema>;
