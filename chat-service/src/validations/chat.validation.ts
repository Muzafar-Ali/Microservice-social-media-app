import { z } from "zod";

export const createDirectConversationSchema = z.object({
  participantUserId: z.string().min(1),
})

export const createGroupConversationSchema = z.object({
  title: z.string().min(1).max(80),
  participantUserIds: z.array(z.string().min(1))
});

export type CreateDirectConversationDTO = z.infer<typeof createDirectConversationSchema>;
export type CreateGroupeConversationDTO = z.infer<typeof createGroupConversationSchema>;