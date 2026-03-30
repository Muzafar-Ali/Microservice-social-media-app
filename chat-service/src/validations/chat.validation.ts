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
  limit: z.preprocess(
      (val) => (val === undefined || val === "" ? undefined : Number(val)),
      z.number().min(1).max(50).default(30)
    ),
  cursor: z.string().optional(),
});

export type CreateDirectConversationDTO = z.infer<typeof createDirectConversationSchema>;
export type CreateGroupeConversationDTO = z.infer<typeof createGroupConversationSchema>;
export type CursorPaginationDTO = z.infer<typeof cursorPaginationSchema>;
export type ConversationParamsDTO = z.infer<typeof conversationParamsSchema>;