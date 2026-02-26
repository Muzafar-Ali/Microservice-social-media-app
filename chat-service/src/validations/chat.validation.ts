import { z } from "zod";

export const createConversationSchema = z.object({
  type: z.enum(["DIRECT", "GROUP"]),
  // DIRECT:
  participantUserId: z.string().min(1).optional(),
  // GROUP:
  title: z.string().min(1).max(80).optional(),
  participantUserIds: z.array(z.string().min(1)).optional(),
});

export type CreateConversationDTO = z.infer<typeof createConversationSchema>;