import { z } from 'zod';

export const followTargetParamsSchema = z.object({
  targetUserId: z.uuid('targetUserId must be a valid cuid'),
});

export type FollowTargetParamsDto = z.infer<typeof followTargetParamsSchema>;
