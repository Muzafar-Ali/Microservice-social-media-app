import { z } from 'zod';

export const followUserParamsSchema = z.object({
  targetUserId: z.uuid('targetUserId must be a valid uuid'),
});

export const userCreatedPayloadSchema = z.object({
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
  createdAt: z.iso.datetime({ error: 'createdAt must be a valid ISO datetime' }),
  updatedAt: z.iso.datetime({ error: 'updatedAt must be a valid ISO datetime' }).optional(),
});

export const userCreatedEventSchema = z.object({
  eventId: z.string().min(1, { error: 'eventId is required' }),
  eventName: z.literal('user.created'),
  eventVersion: z.number().int().positive(),
  occurredAt: z.iso.datetime({ error: 'occurredAt must be a valid ISO datetime' }),
  producerService: z.string().min(1, { error: 'producerService is required' }),
  partitionKey: z.string().min(1, { error: 'partitionKey is required' }),
  data: userCreatedPayloadSchema,
});

export const cursorPaginationQuerySchema = z.object({
  cursor: z.string().trim().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1, { error: 'limit must be at least 1' })
    .max(50, { error: 'limit must be at most 50' })
    .optional(),
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

export type FollowUserParamsDto = z.infer<typeof followUserParamsSchema>;
export type UserCreatedEvent = z.infer<typeof userCreatedEventSchema>;
export type CursorPaginationQueryDto = z.infer<typeof cursorPaginationQuerySchema>;
export type UserUpdatedEvent = z.infer<typeof userUpdatedEventSchema>;
