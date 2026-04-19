import { z } from 'zod';

export const followTargetParamsSchema = z.object({
  targetUserId: z.uuid('targetUserId must be a valid cuid'),
});

export const userCreatedPayloadSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  displayName: z.string().nullable(),
  avatarUrl: z
    .object({
      secureUrl: z.string().url(),
      publicId: z.string().min(1),
    })
    .nullable(),
  status: z.string().min(1),
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

export type FollowTargetParamsDto = z.infer<typeof followTargetParamsSchema>;
export type UserCreatedEvent = z.infer<typeof userCreatedEventSchema>;
