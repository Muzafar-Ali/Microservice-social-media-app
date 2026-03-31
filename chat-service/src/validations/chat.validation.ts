import { z } from "zod";

export const createDirectConversationSchema = z.object({
  participantUserId: z.string().min(1),
})

export const createGroupConversationSchema = z.object({
  title: z.string().min(1).max(80),
  participantUserIds: z.array(z.string().min(1))
});

export const conversationParamsSchema = z.object({
  conversationId: z.string().min(1, "conversationId is required"),
});

export const cursorPaginationSchema = z.object({
  limit: z.coerce.number()
    .int("limit must be an integer")
    .min(1, "limit must be at least 1")
    .max(50, "limit can not exceed 50")
    .default(20),
  cursor: z
    .string()
    .optional(),
});

export type CreateDirectConversationDTO = z.infer<typeof createDirectConversationSchema>;
export type CreateGroupeConversationDTO = z.infer<typeof createGroupConversationSchema>;
export type CursorPaginationDTO = z.infer<typeof cursorPaginationSchema>;
export type ConversationParamsDTO = z.infer<typeof conversationParamsSchema>;