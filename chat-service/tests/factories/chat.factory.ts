import { ConversationType, MessageType, ParticipantRole } from '../../src/generated/prisma/enums.js';

export const testCreatedAt = new Date('2026-01-01T10:00:00.000Z');
export const testUpdatedAt = new Date('2026-01-01T10:05:00.000Z');
export const testReadAt = new Date('2026-01-01T10:10:00.000Z');

export const createParticipant = (overrides: Record<string, unknown> = {}) => ({
  userId: 'user-1',
  role: ParticipantRole.MEMBER,
  joinedAt: testCreatedAt,
  lastReadAt: null,
  lastReadMessageId: null,
  deletedAt: null,
  ...overrides,
});

export const createConversation = (overrides: Record<string, unknown> = {}) => ({
  id: 'conversation-1',
  type: ConversationType.DIRECT,
  title: null,
  createdAt: testCreatedAt,
  updatedAt: testUpdatedAt,
  lastMessageAt: null,
  lastMessageId: null,
  participants: [createParticipant({ userId: 'user-1' }), createParticipant({ userId: 'user-2' })],
  lastMessage: null,
  ...overrides,
});

export const createMessageAttachment = (overrides: Record<string, unknown> = {}) => ({
  id: 'attachment-1',
  type: 'IMAGE',
  url: 'https://cdn.example.com/chat/image.jpg',
  thumbnailUrl: 'https://cdn.example.com/chat/image-thumb.jpg',
  mimeType: 'image/jpeg',
  fileName: 'image.jpg',
  sizeBytes: 1024,
  width: 1080,
  height: 1350,
  durationSec: null,
  sortOrder: 0,
  ...overrides,
});

export const createMessageReceipt = (overrides: Record<string, unknown> = {}) => ({
  userId: 'user-2',
  deliveredAt: testReadAt,
  seenAt: null,
  ...overrides,
});

export const createMessage = (overrides: Record<string, unknown> = {}) => ({
  id: 'message-1',
  conversationId: 'conversation-1',
  senderId: 'user-1',
  type: MessageType.TEXT,
  body: 'Hello',
  metadata: null,
  clientMessageId: 'client-message-1',
  replyToMessageId: null,
  attachments: [],
  receipts: [],
  createdAt: testCreatedAt,
  editedAt: null,
  deletedAt: null,
  ...overrides,
});
