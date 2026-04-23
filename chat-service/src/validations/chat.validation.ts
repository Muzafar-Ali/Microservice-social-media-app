import { z } from 'zod';

const conversationTypeSchema = z.enum(['DIRECT', 'GROUP']);
const participantRoleSchema = z.enum(['MEMBER', 'ADMIN']);
const messageTypeSchema = z.enum(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'SYSTEM', 'SHARED_POST']);
const attachmentTypeSchema = z.enum(['IMAGE', 'VIDEO', 'AUDIO', 'FILE']);

/**
 * Common reusable schemas
 */
export const idParamSchema = z.string().trim().min(1, 'id is required');

export const conversationParamsSchema = z.object({
  conversationId: z.string().trim().min(1, 'conversationId is required'),
});

export const messageParamsSchema = z.object({
  messageId: z.string().trim().min(1, 'messageId is required'),
});

export const cursorPaginationSchema = z.object({
  limit: z.coerce
    .number()
    .int('limit must be an integer')
    .min(1, 'limit must be at least 1')
    .max(50, 'limit can not exceed 50')
    .default(20),
  cursor: z.string().trim().min(1, 'cursor can not be empty').optional(),
});

/**
 * Conversation schemas
 */
export const createDirectConversationSchema = z.object({
  participantUserId: z.string().trim().min(1, 'participantUserId is required'),
});

export const createGroupConversationSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(80, 'title cannot exceed 80 characters'),
  participantUserIds: z
    .array(z.string().trim().min(1, 'participant user id is required'))
    .min(1, 'At least one participant is required')
    .max(100, 'Group cannot exceed 100 participants'),
});

export const updateGroupConversationSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(80, 'title cannot exceed 80 characters'),
});

export const addParticipantsSchema = z.object({
  participantUserIds: z
    .array(z.string().trim().min(1, 'participant user id is required'))
    .min(1, 'At least one participant is required')
    .max(100, 'Cannot add more than 100 participants at once'),
});

export const removeParticipantSchema = z.object({
  participantUserId: z.string().trim().min(1, 'participantUserId is required'),
});

export const markConversationReadSchema = z.object({
  lastReadMessageId: z.string().trim().min(1, 'lastReadMessageId is required'),
});

/**
 * Message attachment schemas
 */
export const messageAttachmentInputSchema = z.object({
  type: attachmentTypeSchema,
  url: z.url('attachment url must be a valid URL'),
  thumbnailUrl: z.url('thumbnailUrl must be a valid URL').nullable().optional(),
  mimeType: z.string().trim().max(255, 'mimeType cannot exceed 255 characters').nullable().optional(),
  fileName: z.string().trim().max(255, 'fileName cannot exceed 255 characters').nullable().optional(),
  sizeBytes: z
    .number()
    .int('sizeBytes must be an integer')
    .positive('sizeBytes must be positive')
    .nullable()
    .optional(),
  width: z.number().int('width must be an integer').positive('width must be positive').nullable().optional(),
  height: z.number().int('height must be an integer').positive('height must be positive').nullable().optional(),
  durationSec: z
    .number()
    .int('durationSec must be an integer')
    .positive('durationSec must be positive')
    .nullable()
    .optional(),
  sortOrder: z.number().int('sortOrder must be an integer').min(0, 'sortOrder cannot be negative').default(0),
});

/**
 * Message schemas
 */
export const sendMessageSchema = z
  .object({
    type: messageTypeSchema.default('TEXT'),
    body: z.string().trim().max(5000, 'body cannot exceed 5000 characters').nullable().optional(),
    metadata: z.unknown().nullable().optional(),
    clientMessageId: z
      .string()
      .trim()
      .min(1, 'clientMessageId is required')
      .max(100, 'clientMessageId cannot exceed 100 characters'),
    replyToMessageId: z.string().trim().min(1, 'replyToMessageId cannot be empty').nullable().optional(),
    attachments: z.array(messageAttachmentInputSchema).max(10, 'attachments cannot exceed 10 items').default([]),
  })
  .superRefine((value, context) => {
    const hasBody = typeof value.body === 'string' && value.body.trim().length > 0;

    const hasAttachments = value.attachments.length > 0;

    if (!hasBody && !hasAttachments) {
      context.addIssue({
        code: 'custom',
        path: ['body'],
        message: 'Message must contain body or at least one attachment',
      });
    }

    if (value.type === 'TEXT' && hasAttachments) {
      context.addIssue({
        code: 'custom',
        path: ['attachments'],
        message: 'TEXT messages cannot include attachments',
      });
    }

    if (['IMAGE', 'VIDEO', 'AUDIO', 'FILE'].includes(value.type) && !hasAttachments) {
      context.addIssue({
        code: 'custom',
        path: ['attachments'],
        message: `${value.type} messages must include at least one attachment`,
      });
    }

    if (value.type === 'SYSTEM') {
      context.addIssue({
        code: 'custom',
        path: ['type'],
        message: 'SYSTEM messages cannot be created directly by clients',
      });
    }

    if (value.type === 'SHARED_POST' && value.metadata == null) {
      context.addIssue({
        code: 'custom',
        path: ['metadata'],
        message: 'SHARED_POST messages must include metadata',
      });
    }
  });

export const editMessageSchema = z.object({
  body: z.string().trim().max(5000, 'body cannot exceed 5000 characters').min(1, 'body cannot be empty'),
});

export const deleteMessageSchema = z.object({
  forEveryone: z.boolean().default(false),
});

export const addReactionSchema = z.object({
  reaction: z.string().trim().min(1, 'reaction is required').max(50, 'reaction cannot exceed 50 characters'),
});

export const removeReactionSchema = z.object({
  reaction: z.string().trim().min(1, 'reaction is required').max(50, 'reaction cannot exceed 50 characters'),
});

/**
 * Socket event payload schemas
 */
export const joinConversationRoomSchema = z.object({
  conversationId: z.string().trim().min(1, 'conversationId is required'),
});

export const leaveConversationRoomSchema = z.object({
  conversationId: z.string().trim().min(1, 'conversationId is required'),
});

export const typingEventSchema = z.object({
  conversationId: z.string().trim().min(1, 'conversationId is required'),
});

export const messageDeliveredSchema = z.object({
  conversationId: z.string().trim().min(1, 'conversationId is required'),
  messageId: z.string().trim().min(1, 'messageId is required'),
});

export const messageReadSchema = z.object({
  conversationId: z.string().trim().min(1, 'conversationId is required'),
  lastReadMessageId: z.string().trim().min(1, 'lastReadMessageId is required'),
});

export const conversationParticipantParamsSchema = z.object({
  conversationId: z.string().trim().min(1, 'conversationId is required'),
  participantUserId: z.string().trim().min(1, 'participantUserId is required'),
});

export type ConversationType = z.infer<typeof conversationTypeSchema>;
export type ParticipantRole = z.infer<typeof participantRoleSchema>;
export type MessageType = z.infer<typeof messageTypeSchema>;
export type AttachmentType = z.infer<typeof attachmentTypeSchema>;

export type CreateDirectConversationDto = z.infer<typeof createDirectConversationSchema>;
export type CreateGroupConversationDto = z.infer<typeof createGroupConversationSchema>;
export type UpdateGroupConversationDto = z.infer<typeof updateGroupConversationSchema>;
export type ConversationParticipantParamsDto = z.infer<typeof conversationParticipantParamsSchema>;
export type AddParticipantsDto = z.infer<typeof addParticipantsSchema>;
export type RemoveParticipantDto = z.infer<typeof removeParticipantSchema>;
export type CursorPaginationDto = z.infer<typeof cursorPaginationSchema>;
export type ConversationParamsDto = z.infer<typeof conversationParamsSchema>;
export type MessageParamsDto = z.infer<typeof messageParamsSchema>;
export type MarkConversationReadDto = z.infer<typeof markConversationReadSchema>;
export type MessageAttachmentInputDto = z.infer<typeof messageAttachmentInputSchema>;
export type SendMessageDto = z.infer<typeof sendMessageSchema>;
export type EditMessageDto = z.infer<typeof editMessageSchema>;
export type DeleteMessageDto = z.infer<typeof deleteMessageSchema>;
export type AddReactionDto = z.infer<typeof addReactionSchema>;
export type RemoveReactionDto = z.infer<typeof removeReactionSchema>;
export type JoinConversationRoomDto = z.infer<typeof joinConversationRoomSchema>;
export type LeaveConversationRoomDto = z.infer<typeof leaveConversationRoomSchema>;
export type TypingEventDto = z.infer<typeof typingEventSchema>;
export type MessageDeliveredDto = z.infer<typeof messageDeliveredSchema>;
export type MessageReadDto = z.infer<typeof messageReadSchema>;
