import { jest } from '@jest/globals';
import { StatusCodes } from 'http-status-codes';
import { ChatService } from '../../../src/services/chat.service.js';
import ApiErrorHandler from '../../../src/utils/apiErrorHandlerClass.js';
import { ConversationType, MessageType, ParticipantRole } from '../../../src/generated/prisma/enums.js';
import {
  createConversation,
  createMessage,
  createMessageAttachment,
  createMessageReceipt,
  createParticipant,
  testCreatedAt,
  testUpdatedAt,
} from '../../factories/chat.factory.js';

const createChatRepositoryMock = () => ({
  findExistingDirectConversation: jest.fn(),
  createDirectConversation: jest.fn(),
  isDirectConversationUniqueConflict: jest.fn(),
  createGroupConversation: jest.fn(),
  listUserConversations: jest.fn(),
  countUnreadMessagesForConversations: jest.fn(),
  isUserParticipant: jest.fn(),
  findMessageByClientMessageId: jest.fn(),
  isMessageClientIdUniqueConflict: jest.fn(),
  findMessageById: jest.fn(),
  createMessage: jest.fn(),
  listMessagesByConversation: jest.fn(),
  findParticipant: jest.fn(),
  updateParticipantReadState: jest.fn(),
  markMessagesSeenUpTo: jest.fn(),
  findConversationMessageById: jest.fn(),
  upsertMessageDeliveryReceipt: jest.fn(),
  softDeleteMessage: jest.fn(),
  findConversationById: jest.fn(),
  updateConversationLastMessageFromLatest: jest.fn(),
  findReaction: jest.fn(),
  addReaction: jest.fn(),
  removeReaction: jest.fn(),
  findConversationByIdWithParticipants: jest.fn(),
  updateGroupConversationTitle: jest.fn(),
  addParticipantsToConversation: jest.fn(),
  removeParticipantFromConversation: jest.fn(),
  countConversationAdmins: jest.fn(),
});

const expectApiError = async (action: Promise<unknown>, statusCode: number, message: string) => {
  await expect(action).rejects.toMatchObject({
    statusCode,
    message,
  });
};

describe('ChatService', () => {
  let chatRepository: ReturnType<typeof createChatRepositoryMock>;
  let chatService: ChatService;

  beforeEach(() => {
    jest.clearAllMocks();
    chatRepository = createChatRepositoryMock();
    chatService = new ChatService(chatRepository as never);
  });

  describe('createDirectConversation', () => {
    it('rejects direct conversation creation without another participant', async () => {
      await expectApiError(
        chatService.createDirectConversation({
          creatorUserId: 'user-1',
          type: 'DIRECT',
        }),
        StatusCodes.BAD_REQUEST,
        'participantUserId is required for DIRECT chat',
      );

      expect(chatRepository.findExistingDirectConversation).not.toHaveBeenCalled();
      expect(chatRepository.createDirectConversation).not.toHaveBeenCalled();
    });

    it('rejects direct conversation creation with self', async () => {
      await expectApiError(
        chatService.createDirectConversation({
          creatorUserId: 'user-1',
          type: 'DIRECT',
          participantUserId: 'user-1',
        }),
        StatusCodes.BAD_REQUEST,
        'You cannot create a DIRECT chat with yourself',
      );

      expect(chatRepository.findExistingDirectConversation).not.toHaveBeenCalled();
      expect(chatRepository.createDirectConversation).not.toHaveBeenCalled();
    });

    it('returns an existing direct conversation instead of creating a duplicate', async () => {
      const existingConversation = createConversation();
      chatRepository.findExistingDirectConversation.mockResolvedValue(existingConversation as never);

      const result = await chatService.createDirectConversation({
        creatorUserId: 'user-1',
        type: 'DIRECT',
        participantUserId: 'user-2',
      });

      expect(chatRepository.createDirectConversation).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        id: 'conversation-1',
        type: ConversationType.DIRECT,
        participants: [
          { userId: 'user-1', role: ParticipantRole.MEMBER },
          { userId: 'user-2', role: ParticipantRole.MEMBER },
        ],
      });
    });

    it('creates and maps a direct conversation when none exists', async () => {
      const createdConversation = createConversation({ id: 'conversation-created' });
      chatRepository.findExistingDirectConversation.mockResolvedValue(null as never);
      chatRepository.createDirectConversation.mockResolvedValue(createdConversation as never);

      const result = await chatService.createDirectConversation({
        creatorUserId: 'user-1',
        type: 'DIRECT',
        participantUserId: 'user-2',
      });

      expect(chatRepository.createDirectConversation).toHaveBeenCalledWith('user-1', 'user-2');
      expect(result).toMatchObject({
        id: 'conversation-created',
        createdAt: testCreatedAt.toISOString(),
        updatedAt: testUpdatedAt.toISOString(),
      });
    });

    it('returns the raced direct conversation after a unique conflict', async () => {
      const uniqueConflict = new Error('unique conflict');
      const racedConversation = createConversation({ id: 'conversation-raced' });
      chatRepository.findExistingDirectConversation
        .mockResolvedValueOnce(null as never)
        .mockResolvedValueOnce(racedConversation as never);
      chatRepository.createDirectConversation.mockRejectedValue(uniqueConflict as never);
      chatRepository.isDirectConversationUniqueConflict.mockReturnValue(true as never);

      const result = await chatService.createDirectConversation({
        creatorUserId: 'user-1',
        type: 'DIRECT',
        participantUserId: 'user-2',
      });

      expect(chatRepository.findExistingDirectConversation).toHaveBeenCalledTimes(2);
      expect(result.id).toBe('conversation-raced');
    });
  });

  describe('createGroupConversation', () => {
    it('deduplicates participants, trims ids, excludes the creator, and creates a group', async () => {
      const createdConversation = createConversation({
        id: 'group-1',
        type: ConversationType.GROUP,
        title: 'Launch Team',
        participants: [
          createParticipant({ userId: 'creator', role: ParticipantRole.ADMIN }),
          createParticipant({ userId: 'user-2' }),
          createParticipant({ userId: 'user-3' }),
        ],
      });
      chatRepository.createGroupConversation.mockResolvedValue(createdConversation as never);

      const result = await chatService.createGroupConversation({
        creatorUserId: 'creator',
        type: 'GROUP',
        title: 'Launch Team',
        participantUserIds: [' user-2 ', 'user-2', 'creator', '', 'user-3'],
      });

      expect(chatRepository.createGroupConversation).toHaveBeenCalledWith({
        creatorUserId: 'creator',
        title: 'Launch Team',
        participantUserIds: ['user-2', 'user-3'],
      });
      expect(result).toMatchObject({
        id: 'group-1',
        type: ConversationType.GROUP,
        title: 'Launch Team',
      });
    });

    it('rejects group creation when no valid participant remains after normalization', async () => {
      await expectApiError(
        chatService.createGroupConversation({
          creatorUserId: 'creator',
          type: 'GROUP',
          title: 'Empty Group',
          participantUserIds: ['creator', ' ', 'creator'],
        }),
        StatusCodes.BAD_REQUEST,
        'GROUP chat requires at least one participant other than the creator',
      );

      expect(chatRepository.createGroupConversation).not.toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    it('rejects message send when the sender is not a participant', async () => {
      chatRepository.isUserParticipant.mockResolvedValue(false as never);

      await expectApiError(
        chatService.sendMessage({
          senderId: 'outsider',
          conversationId: 'conversation-1',
          type: MessageType.TEXT,
          body: 'Hello',
          clientMessageId: 'client-message-1',
        }),
        StatusCodes.FORBIDDEN,
        'You are not a participant of this conversation',
      );

      expect(chatRepository.findMessageByClientMessageId).not.toHaveBeenCalled();
    });

    it('rejects client-created system messages', async () => {
      chatRepository.isUserParticipant.mockResolvedValue(true as never);

      await expectApiError(
        chatService.sendMessage({
          senderId: 'user-1',
          conversationId: 'conversation-1',
          type: MessageType.SYSTEM,
          body: 'system',
          clientMessageId: 'client-message-1',
        }),
        StatusCodes.BAD_REQUEST,
        'SYSTEM messages cannot be created directly by clients',
      );

      expect(chatRepository.findMessageByClientMessageId).not.toHaveBeenCalled();
    });

    it('returns an existing message for duplicate clientMessageId without creating a new row', async () => {
      const existingMessage = createMessage({
        id: 'message-existing',
        body: 'Already sent',
        receipts: [createMessageReceipt()],
      });
      chatRepository.isUserParticipant.mockResolvedValue(true as never);
      chatRepository.findMessageByClientMessageId.mockResolvedValue(existingMessage as never);

      const result = await chatService.sendMessage({
        senderId: 'user-1',
        conversationId: 'conversation-1',
        type: MessageType.TEXT,
        body: 'Already sent',
        clientMessageId: 'client-message-1',
      });

      expect(chatRepository.createMessage).not.toHaveBeenCalled();
      expect(result.created).toBe(false);
      expect(result.message).toMatchObject({
        id: 'message-existing',
        body: 'Already sent',
        receipts: [{ userId: 'user-2', deliveredAt: expect.any(String), seenAt: null }],
      });
    });

    it('rejects replies to missing messages', async () => {
      chatRepository.isUserParticipant.mockResolvedValue(true as never);
      chatRepository.findMessageByClientMessageId.mockResolvedValue(null as never);
      chatRepository.findMessageById.mockResolvedValue(null as never);

      await expectApiError(
        chatService.sendMessage({
          senderId: 'user-1',
          conversationId: 'conversation-1',
          type: MessageType.TEXT,
          body: 'Reply',
          clientMessageId: 'client-message-2',
          replyToMessageId: 'missing-message',
        }),
        StatusCodes.NOT_FOUND,
        'Reply target message not found',
      );

      expect(chatRepository.createMessage).not.toHaveBeenCalled();
    });

    it('rejects replies to messages from another conversation', async () => {
      chatRepository.isUserParticipant.mockResolvedValue(true as never);
      chatRepository.findMessageByClientMessageId.mockResolvedValue(null as never);
      chatRepository.findMessageById.mockResolvedValue(createMessage({ conversationId: 'other-conversation' }) as never);

      await expectApiError(
        chatService.sendMessage({
          senderId: 'user-1',
          conversationId: 'conversation-1',
          type: MessageType.TEXT,
          body: 'Reply',
          clientMessageId: 'client-message-2',
          replyToMessageId: 'message-1',
        }),
        StatusCodes.BAD_REQUEST,
        'Reply target message does not belong to this conversation',
      );

      expect(chatRepository.createMessage).not.toHaveBeenCalled();
    });

    it('creates a new message with normalized body and mapped attachments', async () => {
      const createdMessage = createMessage({
        id: 'message-created',
        body: 'Trimmed body',
        attachments: [createMessageAttachment()],
      });
      chatRepository.isUserParticipant.mockResolvedValue(true as never);
      chatRepository.findMessageByClientMessageId.mockResolvedValue(null as never);
      chatRepository.createMessage.mockResolvedValue(createdMessage as never);

      const result = await chatService.sendMessage({
        senderId: 'user-1',
        conversationId: 'conversation-1',
        type: MessageType.IMAGE,
        body: '  Trimmed body  ',
        metadata: { width: 1080 },
        clientMessageId: 'client-message-3',
        attachments: [
          {
            type: 'IMAGE',
            url: 'https://cdn.example.com/chat/image.jpg',
            thumbnailUrl: 'https://cdn.example.com/chat/image-thumb.jpg',
            sortOrder: 0,
          },
        ],
      });

      expect(chatRepository.createMessage).toHaveBeenCalledWith({
        conversationId: 'conversation-1',
        senderId: 'user-1',
        type: MessageType.IMAGE,
        body: 'Trimmed body',
        metadata: { width: 1080 },
        clientMessageId: 'client-message-3',
        replyToMessageId: null,
        attachments: [
          {
            type: 'IMAGE',
            url: 'https://cdn.example.com/chat/image.jpg',
            thumbnailUrl: 'https://cdn.example.com/chat/image-thumb.jpg',
            sortOrder: 0,
          },
        ],
      });
      expect(result).toMatchObject({
        created: true,
        message: {
          id: 'message-created',
          attachments: [
            {
              id: 'attachment-1',
              url: 'https://cdn.example.com/chat/image.jpg',
              sortOrder: 0,
            },
          ],
        },
      });
    });

    it('returns a raced existing message when create hits a clientMessageId unique conflict', async () => {
      const uniqueConflict = new Error('client id conflict');
      const racedMessage = createMessage({ id: 'message-raced', clientMessageId: 'client-message-race' });
      chatRepository.isUserParticipant.mockResolvedValue(true as never);
      chatRepository.findMessageByClientMessageId
        .mockResolvedValueOnce(null as never)
        .mockResolvedValueOnce(racedMessage as never);
      chatRepository.createMessage.mockRejectedValue(uniqueConflict as never);
      chatRepository.isMessageClientIdUniqueConflict.mockReturnValue(true as never);

      const result = await chatService.sendMessage({
        senderId: 'user-1',
        conversationId: 'conversation-1',
        type: MessageType.TEXT,
        body: 'Race',
        clientMessageId: 'client-message-race',
      });

      expect(chatRepository.findMessageByClientMessageId).toHaveBeenCalledTimes(2);
      expect(result).toMatchObject({
        created: false,
        message: { id: 'message-raced' },
      });
    });
  });

  describe('getConversationMessages', () => {
    it('rejects message reads when the user is not a participant', async () => {
      chatRepository.isUserParticipant.mockResolvedValue(false as never);

      await expectApiError(
        chatService.getConversationMessages({
          userId: 'outsider',
          conversationId: 'conversation-1',
          limit: 20,
        }),
        StatusCodes.FORBIDDEN,
        'You are not a participant of this conversation',
      );

      expect(chatRepository.listMessagesByConversation).not.toHaveBeenCalled();
    });

    it('returns paginated messages with nextCursor when one extra row is fetched', async () => {
      chatRepository.isUserParticipant.mockResolvedValue(true as never);
      chatRepository.listMessagesByConversation.mockResolvedValue([
        createMessage({ id: 'message-1' }),
        createMessage({ id: 'message-2' }),
        createMessage({ id: 'message-3' }),
      ] as never);

      const result = await chatService.getConversationMessages({
        userId: 'user-1',
        conversationId: 'conversation-1',
        limit: 2,
        cursorMessageId: 'cursor-message',
      });

      expect(chatRepository.listMessagesByConversation).toHaveBeenCalledWith({
        conversationId: 'conversation-1',
        limit: 2,
        cursorMessageId: 'cursor-message',
      });
      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBe('message-2');
    });
  });

  describe('markConversationRead', () => {
    it('rejects read updates for non-participants', async () => {
      chatRepository.isUserParticipant.mockResolvedValue(false as never);

      await expectApiError(
        chatService.markConversationRead({
          userId: 'outsider',
          conversationId: 'conversation-1',
          lastReadMessageId: 'message-1',
        }),
        StatusCodes.FORBIDDEN,
        'You are not a participant of this conversation',
      );
    });

    it('rejects read updates when the target message is missing', async () => {
      chatRepository.isUserParticipant.mockResolvedValue(true as never);
      chatRepository.findMessageById.mockResolvedValue(null as never);

      await expectApiError(
        chatService.markConversationRead({
          userId: 'user-1',
          conversationId: 'conversation-1',
          lastReadMessageId: 'missing-message',
        }),
        StatusCodes.NOT_FOUND,
        'lastReadMessageId not found',
      );
    });

    it('rejects read updates when the message belongs to another conversation', async () => {
      chatRepository.isUserParticipant.mockResolvedValue(true as never);
      chatRepository.findMessageById.mockResolvedValue(createMessage({ conversationId: 'other-conversation' }) as never);

      await expectApiError(
        chatService.markConversationRead({
          userId: 'user-1',
          conversationId: 'conversation-1',
          lastReadMessageId: 'message-1',
        }),
        StatusCodes.BAD_REQUEST,
        'lastReadMessageId does not belong to this conversation',
      );
    });

    it('returns existing read state when it is already ahead of the target message', async () => {
      const lastReadAt = new Date('2026-01-01T10:20:00.000Z');
      chatRepository.isUserParticipant.mockResolvedValue(true as never);
      chatRepository.findMessageById.mockResolvedValue(createMessage({ createdAt: testCreatedAt }) as never);
      chatRepository.findParticipant.mockResolvedValue({
        userId: 'user-1',
        lastReadAt,
        lastReadMessageId: 'message-later',
      } as never);

      const result = await chatService.markConversationRead({
        userId: 'user-1',
        conversationId: 'conversation-1',
        lastReadMessageId: 'message-1',
      });

      expect(chatRepository.updateParticipantReadState).not.toHaveBeenCalled();
      expect(chatRepository.markMessagesSeenUpTo).not.toHaveBeenCalled();
      expect(result).toEqual({
        conversationId: 'conversation-1',
        userId: 'user-1',
        lastReadMessageId: 'message-later',
        lastReadAt: lastReadAt.toISOString(),
      });
    });

    it('updates participant read state and marks previous messages seen', async () => {
      chatRepository.isUserParticipant.mockResolvedValue(true as never);
      chatRepository.findMessageById.mockResolvedValue(createMessage({ id: 'message-1', createdAt: testCreatedAt }) as never);
      chatRepository.findParticipant.mockResolvedValue({ userId: 'user-1', lastReadAt: null } as never);
      chatRepository.updateParticipantReadState.mockResolvedValue({
        lastReadMessageId: 'message-1',
        lastReadAt: testCreatedAt,
      } as never);

      const result = await chatService.markConversationRead({
        userId: 'user-1',
        conversationId: 'conversation-1',
        lastReadMessageId: 'message-1',
      });

      expect(chatRepository.updateParticipantReadState).toHaveBeenCalledWith({
        conversationId: 'conversation-1',
        userId: 'user-1',
        lastReadMessageId: 'message-1',
        lastReadAt: testCreatedAt,
      });
      expect(chatRepository.markMessagesSeenUpTo).toHaveBeenCalledWith({
        conversationId: 'conversation-1',
        userId: 'user-1',
        seenAt: testCreatedAt,
      });
      expect(result.lastReadAt).toBe(testCreatedAt.toISOString());
    });
  });

  describe('markMessageDelivered', () => {
    it('rejects delivery receipts from non-participants', async () => {
      chatRepository.isUserParticipant.mockResolvedValue(false as never);

      await expectApiError(
        chatService.markMessageDelivered({
          userId: 'outsider',
          conversationId: 'conversation-1',
          messageId: 'message-1',
        }),
        StatusCodes.FORBIDDEN,
        'You are not a participant of this conversation',
      );
    });

    it('rejects delivery receipts for missing conversation messages', async () => {
      chatRepository.isUserParticipant.mockResolvedValue(true as never);
      chatRepository.findConversationMessageById.mockResolvedValue(null as never);

      await expectApiError(
        chatService.markMessageDelivered({
          userId: 'user-2',
          conversationId: 'conversation-1',
          messageId: 'missing-message',
        }),
        StatusCodes.NOT_FOUND,
        'Message not found in this conversation',
      );
    });

    it('rejects sender marking their own message as delivered', async () => {
      chatRepository.isUserParticipant.mockResolvedValue(true as never);
      chatRepository.findConversationMessageById.mockResolvedValue(createMessage({ senderId: 'user-1' }) as never);

      await expectApiError(
        chatService.markMessageDelivered({
          userId: 'user-1',
          conversationId: 'conversation-1',
          messageId: 'message-1',
        }),
        StatusCodes.BAD_REQUEST,
        'Sender cannot mark own message as delivered',
      );
    });

    it('upserts and returns a delivery receipt for another participant', async () => {
      const deliveredAt = new Date('2026-01-01T10:30:00.000Z');
      chatRepository.isUserParticipant.mockResolvedValue(true as never);
      chatRepository.findConversationMessageById.mockResolvedValue(createMessage({ senderId: 'user-1' }) as never);
      chatRepository.upsertMessageDeliveryReceipt.mockResolvedValue({ deliveredAt } as never);

      const result = await chatService.markMessageDelivered({
        userId: 'user-2',
        conversationId: 'conversation-1',
        messageId: 'message-1',
      });

      expect(chatRepository.upsertMessageDeliveryReceipt).toHaveBeenCalledWith({
        messageId: 'message-1',
        userId: 'user-2',
        deliveredAt: expect.any(Date),
      });
      expect(result).toEqual({
        conversationId: 'conversation-1',
        messageId: 'message-1',
        userId: 'user-2',
        deliveredAt: deliveredAt.toISOString(),
      });
    });
  });

  describe('deleteMessage', () => {
    it('rejects delete-for-me because only delete-for-everyone is supported', async () => {
      await expectApiError(
        chatService.deleteMessage({
          userId: 'user-1',
          messageId: 'message-1',
          forEveryone: false,
        }),
        StatusCodes.BAD_REQUEST,
        'Only forEveryone delete is supported right now',
      );
    });

    it('rejects deleting a missing message', async () => {
      chatRepository.findMessageById.mockResolvedValue(null as never);

      await expectApiError(
        chatService.deleteMessage({
          userId: 'user-1',
          messageId: 'missing-message',
          forEveryone: true,
        }),
        StatusCodes.NOT_FOUND,
        'Message not found',
      );
    });

    it('rejects deleting another user message', async () => {
      chatRepository.findMessageById.mockResolvedValue(createMessage({ senderId: 'user-2' }) as never);

      await expectApiError(
        chatService.deleteMessage({
          userId: 'user-1',
          messageId: 'message-1',
          forEveryone: true,
        }),
        StatusCodes.FORBIDDEN,
        'You can only delete your own messages',
      );
    });

    it('rejects deleting an already deleted message', async () => {
      chatRepository.findMessageById.mockResolvedValue(createMessage({ deletedAt: testUpdatedAt }) as never);

      await expectApiError(
        chatService.deleteMessage({
          userId: 'user-1',
          messageId: 'message-1',
          forEveryone: true,
        }),
        StatusCodes.BAD_REQUEST,
        'Message is already deleted',
      );
    });

    it('soft deletes a message and updates conversation last message when needed', async () => {
      const deletedAt = new Date('2026-01-01T11:00:00.000Z');
      chatRepository.findMessageById.mockResolvedValue(createMessage({ id: 'message-1', senderId: 'user-1' }) as never);
      chatRepository.softDeleteMessage.mockResolvedValue(createMessage({ id: 'message-1', deletedAt }) as never);
      chatRepository.findConversationById.mockResolvedValue({ id: 'conversation-1', lastMessageId: 'message-1' } as never);
      chatRepository.updateConversationLastMessageFromLatest.mockResolvedValue({
        id: 'conversation-1',
        lastMessageId: 'message-0',
        lastMessageAt: testCreatedAt,
      } as never);

      const result = await chatService.deleteMessage({
        userId: 'user-1',
        messageId: 'message-1',
        forEveryone: true,
      });

      expect(chatRepository.softDeleteMessage).toHaveBeenCalledWith('message-1');
      expect(chatRepository.updateConversationLastMessageFromLatest).toHaveBeenCalledWith('conversation-1');
      expect(result).toEqual({
        conversationId: 'conversation-1',
        messageId: 'message-1',
        deletedBy: 'user-1',
        deletedAt: deletedAt.toISOString(),
        forEveryone: true,
        conversationUpdate: {
          conversationId: 'conversation-1',
          lastMessageId: 'message-0',
          lastMessageAt: testCreatedAt.toISOString(),
        },
      });
    });
  });

  describe('reactions', () => {
    it('returns an existing reaction without creating a duplicate', async () => {
      chatRepository.findMessageById.mockResolvedValue(createMessage() as never);
      chatRepository.isUserParticipant.mockResolvedValue(true as never);
      chatRepository.findReaction.mockResolvedValue({
        id: 'reaction-1',
        messageId: 'message-1',
        userId: 'user-2',
        reaction: 'like',
        createdAt: testCreatedAt,
      } as never);

      const result = await chatService.addReaction({
        userId: 'user-2',
        messageId: 'message-1',
        reaction: 'like',
      });

      expect(chatRepository.addReaction).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        id: 'reaction-1',
        conversationId: 'conversation-1',
        reaction: 'like',
      });
    });

    it('creates a reaction for a participant on an active message', async () => {
      chatRepository.findMessageById.mockResolvedValue(createMessage() as never);
      chatRepository.isUserParticipant.mockResolvedValue(true as never);
      chatRepository.findReaction.mockResolvedValue(null as never);
      chatRepository.addReaction.mockResolvedValue({
        id: 'reaction-2',
        messageId: 'message-1',
        userId: 'user-2',
        reaction: 'heart',
        createdAt: testCreatedAt,
      } as never);

      const result = await chatService.addReaction({
        userId: 'user-2',
        messageId: 'message-1',
        reaction: 'heart',
      });

      expect(chatRepository.addReaction).toHaveBeenCalledWith({
        messageId: 'message-1',
        userId: 'user-2',
        reaction: 'heart',
      });
      expect(result.id).toBe('reaction-2');
    });

    it('rejects reacting to a deleted message', async () => {
      chatRepository.findMessageById.mockResolvedValue(createMessage({ deletedAt: testUpdatedAt }) as never);

      await expectApiError(
        chatService.addReaction({
          userId: 'user-2',
          messageId: 'message-1',
          reaction: 'like',
        }),
        StatusCodes.BAD_REQUEST,
        'Cannot react to a deleted message',
      );
    });

    it('removes a reaction and reports whether anything was deleted', async () => {
      chatRepository.findMessageById.mockResolvedValue(createMessage() as never);
      chatRepository.isUserParticipant.mockResolvedValue(true as never);
      chatRepository.removeReaction.mockResolvedValue({ count: 1 } as never);

      const result = await chatService.removeReaction({
        userId: 'user-2',
        messageId: 'message-1',
        reaction: 'like',
      });

      expect(chatRepository.removeReaction).toHaveBeenCalledWith({
        messageId: 'message-1',
        userId: 'user-2',
        reaction: 'like',
      });
      expect(result).toMatchObject({
        conversationId: 'conversation-1',
        messageId: 'message-1',
        userId: 'user-2',
        reaction: 'like',
        removed: true,
      });
    });
  });

  describe('listMyConversations', () => {
    it('maps conversations with unread counts and last message summary', async () => {
      const conversation = createConversation({
        id: 'conversation-1',
        lastMessageAt: testUpdatedAt,
        lastMessage: createMessage({
          id: 'message-last',
          senderId: 'user-2',
          body: 'Last message',
          createdAt: testUpdatedAt,
        }),
      });
      chatRepository.listUserConversations.mockResolvedValue([conversation] as never);
      chatRepository.countUnreadMessagesForConversations.mockResolvedValue(new Map([['conversation-1', 3]]) as never);

      const result = await chatService.listMyConversations('user-1');

      expect(chatRepository.countUnreadMessagesForConversations).toHaveBeenCalledWith({
        userId: 'user-1',
        readStates: [{ conversationId: 'conversation-1', lastReadAt: null }],
      });
      expect(result).toMatchObject([
        {
          id: 'conversation-1',
          unreadCount: 3,
          lastMessageAt: testUpdatedAt.toISOString(),
          lastMessage: {
            id: 'message-last',
            senderId: 'user-2',
            body: 'Last message',
          },
        },
      ]);
    });
  });

  describe('remaining idempotency branches', () => {
    it('rethrows non-unique direct conversation create errors', async () => {
      const databaseError = new Error('database down');
      chatRepository.findExistingDirectConversation.mockResolvedValue(null as never);
      chatRepository.createDirectConversation.mockRejectedValue(databaseError as never);
      chatRepository.isDirectConversationUniqueConflict.mockReturnValue(false as never);

      await expect(
        chatService.createDirectConversation({
          creatorUserId: 'user-1',
          type: 'DIRECT',
          participantUserId: 'user-2',
        }),
      ).rejects.toBe(databaseError);
    });

    it('rethrows direct conversation unique conflicts when the raced row cannot be found', async () => {
      const uniqueConflict = new Error('unique conflict');
      chatRepository.findExistingDirectConversation.mockResolvedValue(null as never);
      chatRepository.createDirectConversation.mockRejectedValue(uniqueConflict as never);
      chatRepository.isDirectConversationUniqueConflict.mockReturnValue(true as never);

      await expect(
        chatService.createDirectConversation({
          creatorUserId: 'user-1',
          type: 'DIRECT',
          participantUserId: 'user-2',
        }),
      ).rejects.toBe(uniqueConflict);
    });

    it('rethrows non-unique message create errors', async () => {
      const databaseError = new Error('database down');
      chatRepository.isUserParticipant.mockResolvedValue(true as never);
      chatRepository.findMessageByClientMessageId.mockResolvedValue(null as never);
      chatRepository.createMessage.mockRejectedValue(databaseError as never);
      chatRepository.isMessageClientIdUniqueConflict.mockReturnValue(false as never);

      await expect(
        chatService.sendMessage({
          senderId: 'user-1',
          conversationId: 'conversation-1',
          type: MessageType.TEXT,
          body: 'Hello',
          clientMessageId: 'client-message-error',
        }),
      ).rejects.toBe(databaseError);
    });

    it('rethrows message unique conflicts when the raced row cannot be found', async () => {
      const uniqueConflict = new Error('unique conflict');
      chatRepository.isUserParticipant.mockResolvedValue(true as never);
      chatRepository.findMessageByClientMessageId.mockResolvedValue(null as never);
      chatRepository.createMessage.mockRejectedValue(uniqueConflict as never);
      chatRepository.isMessageClientIdUniqueConflict.mockReturnValue(true as never);

      await expect(
        chatService.sendMessage({
          senderId: 'user-1',
          conversationId: 'conversation-1',
          type: MessageType.TEXT,
          body: 'Hello',
          clientMessageId: 'client-message-race-missing',
        }),
      ).rejects.toBe(uniqueConflict);
    });
  });

  describe('participant and reaction failure branches', () => {
    it('delegates isParticipant to the repository', async () => {
      chatRepository.isUserParticipant.mockResolvedValue(true as never);

      await expect(chatService.isParticipant('conversation-1', 'user-1')).resolves.toBe(true);
      expect(chatRepository.isUserParticipant).toHaveBeenCalledWith('conversation-1', 'user-1');
    });

    it('rejects read updates when the participant row disappears', async () => {
      chatRepository.isUserParticipant.mockResolvedValue(true as never);
      chatRepository.findMessageById.mockResolvedValue(createMessage() as never);
      chatRepository.findParticipant.mockResolvedValue(null as never);

      await expectApiError(
        chatService.markConversationRead({
          userId: 'user-1',
          conversationId: 'conversation-1',
          lastReadMessageId: 'message-1',
        }),
        StatusCodes.FORBIDDEN,
        'You are not a participant of this conversation',
      );
    });

    it('rejects adding reactions to missing messages', async () => {
      chatRepository.findMessageById.mockResolvedValue(null as never);

      await expectApiError(
        chatService.addReaction({ userId: 'user-2', messageId: 'missing-message', reaction: 'like' }),
        StatusCodes.NOT_FOUND,
        'Message not found',
      );
    });

    it('rejects adding reactions by non-participants', async () => {
      chatRepository.findMessageById.mockResolvedValue(createMessage() as never);
      chatRepository.isUserParticipant.mockResolvedValue(false as never);

      await expectApiError(
        chatService.addReaction({ userId: 'outsider', messageId: 'message-1', reaction: 'like' }),
        StatusCodes.FORBIDDEN,
        'You are not a participant of this conversation',
      );
    });

    it('rejects removing reactions from missing messages', async () => {
      chatRepository.findMessageById.mockResolvedValue(null as never);

      await expectApiError(
        chatService.removeReaction({ userId: 'user-2', messageId: 'missing-message', reaction: 'like' }),
        StatusCodes.NOT_FOUND,
        'Message not found',
      );
    });

    it('rejects removing reactions by non-participants', async () => {
      chatRepository.findMessageById.mockResolvedValue(createMessage() as never);
      chatRepository.isUserParticipant.mockResolvedValue(false as never);

      await expectApiError(
        chatService.removeReaction({ userId: 'outsider', messageId: 'message-1', reaction: 'like' }),
        StatusCodes.FORBIDDEN,
        'You are not a participant of this conversation',
      );
    });
  });

  describe('group conversation administration', () => {
    const groupConversation = (overrides: Record<string, unknown> = {}) =>
      createConversation({
        id: 'group-1',
        type: ConversationType.GROUP,
        title: 'Group',
        participants: [
          createParticipant({ userId: 'admin-1', role: ParticipantRole.ADMIN }),
          createParticipant({ userId: 'member-1', role: ParticipantRole.MEMBER }),
        ],
        ...overrides,
      });

    it('updates a group title when the user is an admin', async () => {
      chatRepository.findConversationByIdWithParticipants.mockResolvedValue(groupConversation() as never);
      chatRepository.updateGroupConversationTitle.mockResolvedValue({
        id: 'group-1',
        title: 'New Title',
        updatedAt: testUpdatedAt,
      } as never);

      const result = await chatService.updateGroupConversation({
        userId: 'admin-1',
        conversationId: 'group-1',
        title: '  New Title  ',
      });

      expect(chatRepository.updateGroupConversationTitle).toHaveBeenCalledWith({
        conversationId: 'group-1',
        title: 'New Title',
      });
      expect(result).toEqual({
        conversationId: 'group-1',
        title: 'New Title',
        updatedBy: 'admin-1',
        updatedAt: testUpdatedAt.toISOString(),
      });
    });

    it('rejects group updates by non-admin members', async () => {
      chatRepository.findConversationByIdWithParticipants.mockResolvedValue(groupConversation() as never);

      await expectApiError(
        chatService.updateGroupConversation({
          userId: 'member-1',
          conversationId: 'group-1',
          title: 'Nope',
        }),
        StatusCodes.FORBIDDEN,
        'Only group admins can update group title',
      );
    });

    it('rejects updating a missing group conversation', async () => {
      chatRepository.findConversationByIdWithParticipants.mockResolvedValue(null as never);

      await expectApiError(
        chatService.updateGroupConversation({
          userId: 'admin-1',
          conversationId: 'missing-group',
          title: 'New Title',
        }),
        StatusCodes.NOT_FOUND,
        'Conversation not found',
      );
    });

    it('rejects updating a direct conversation as a group', async () => {
      chatRepository.findConversationByIdWithParticipants.mockResolvedValue(createConversation() as never);

      await expectApiError(
        chatService.updateGroupConversation({
          userId: 'user-1',
          conversationId: 'conversation-1',
          title: 'New Title',
        }),
        StatusCodes.BAD_REQUEST,
        'Only group conversations can be updated',
      );
    });

    it('rejects group updates by users outside the group', async () => {
      chatRepository.findConversationByIdWithParticipants.mockResolvedValue(groupConversation() as never);

      await expectApiError(
        chatService.updateGroupConversation({
          userId: 'outsider',
          conversationId: 'group-1',
          title: 'New Title',
        }),
        StatusCodes.FORBIDDEN,
        'You are not a participant of this conversation',
      );
    });

    it('adds participants after admin authorization and normalization', async () => {
      chatRepository.findConversationByIdWithParticipants.mockResolvedValue(groupConversation() as never);
      chatRepository.addParticipantsToConversation.mockResolvedValue([
        createParticipant({ userId: 'new-1' }),
        createParticipant({ userId: 'new-2' }),
      ] as never);

      const result = await chatService.addParticipants({
        userId: 'admin-1',
        conversationId: 'group-1',
        participantUserIds: [' new-1 ', 'new-1', 'admin-1', '', 'new-2'],
      });

      expect(chatRepository.addParticipantsToConversation).toHaveBeenCalledWith({
        conversationId: 'group-1',
        participantUserIds: ['new-1', 'new-2'],
      });
      expect(result).toMatchObject({
        conversationId: 'group-1',
        participantUserIds: ['new-1', 'new-2'],
        addedBy: 'admin-1',
      });
    });

    it('rejects adding participants that already exist in the active group', async () => {
      chatRepository.findConversationByIdWithParticipants.mockResolvedValue(groupConversation() as never);

      await expectApiError(
        chatService.addParticipants({
          userId: 'admin-1',
          conversationId: 'group-1',
          participantUserIds: ['member-1'],
        }),
        StatusCodes.BAD_REQUEST,
        'User(s) already exist in the conversation: member-1',
      );
    });

    it('rejects adding participants to a missing conversation', async () => {
      chatRepository.findConversationByIdWithParticipants.mockResolvedValue(null as never);

      await expectApiError(
        chatService.addParticipants({
          userId: 'admin-1',
          conversationId: 'missing-group',
          participantUserIds: ['new-1'],
        }),
        StatusCodes.NOT_FOUND,
        'Conversation not found',
      );
    });

    it('rejects adding participants to a direct conversation', async () => {
      chatRepository.findConversationByIdWithParticipants.mockResolvedValue(createConversation() as never);

      await expectApiError(
        chatService.addParticipants({
          userId: 'user-1',
          conversationId: 'conversation-1',
          participantUserIds: ['new-1'],
        }),
        StatusCodes.BAD_REQUEST,
        'Only group conversations can add participants',
      );
    });

    it('rejects adding participants by users outside the group', async () => {
      chatRepository.findConversationByIdWithParticipants.mockResolvedValue(groupConversation() as never);

      await expectApiError(
        chatService.addParticipants({
          userId: 'outsider',
          conversationId: 'group-1',
          participantUserIds: ['new-1'],
        }),
        StatusCodes.FORBIDDEN,
        'You are not a participant of this conversation',
      );
    });

    it('rejects adding participants by non-admin members', async () => {
      chatRepository.findConversationByIdWithParticipants.mockResolvedValue(groupConversation() as never);

      await expectApiError(
        chatService.addParticipants({
          userId: 'member-1',
          conversationId: 'group-1',
          participantUserIds: ['new-1'],
        }),
        StatusCodes.FORBIDDEN,
        'Only group admins can add participants',
      );
    });

    it('rejects adding participants when normalization leaves no user to add', async () => {
      chatRepository.findConversationByIdWithParticipants.mockResolvedValue(groupConversation() as never);

      await expectApiError(
        chatService.addParticipants({
          userId: 'admin-1',
          conversationId: 'group-1',
          participantUserIds: ['admin-1', ' ', 'admin-1'],
        }),
        StatusCodes.BAD_REQUEST,
        'participantUserIds must include at least one user to add',
      );
    });

    it('removes a member when requested by an admin', async () => {
      chatRepository.findConversationByIdWithParticipants.mockResolvedValue(groupConversation() as never);

      const result = await chatService.removeParticipant({
        userId: 'admin-1',
        conversationId: 'group-1',
        participantUserId: 'member-1',
      });

      expect(chatRepository.removeParticipantFromConversation).toHaveBeenCalledWith({
        conversationId: 'group-1',
        participantUserId: 'member-1',
      });
      expect(result).toMatchObject({
        conversationId: 'group-1',
        participantUserId: 'member-1',
        removedBy: 'admin-1',
      });
    });

    it('rejects removing the last admin from a group', async () => {
      chatRepository.findConversationByIdWithParticipants.mockResolvedValue(
        groupConversation({
          participants: [
            createParticipant({ userId: 'admin-1', role: ParticipantRole.ADMIN }),
            createParticipant({ userId: 'admin-2', role: ParticipantRole.ADMIN }),
          ],
        }) as never,
      );
      chatRepository.countConversationAdmins.mockResolvedValue(1 as never);

      await expectApiError(
        chatService.removeParticipant({
          userId: 'admin-2',
          conversationId: 'group-1',
          participantUserId: 'admin-1',
        }),
        StatusCodes.BAD_REQUEST,
        'Cannot remove the last admin from the group',
      );
    });

    it('rejects removing participants from a missing conversation', async () => {
      chatRepository.findConversationByIdWithParticipants.mockResolvedValue(null as never);

      await expectApiError(
        chatService.removeParticipant({
          userId: 'admin-1',
          conversationId: 'missing-group',
          participantUserId: 'member-1',
        }),
        StatusCodes.NOT_FOUND,
        'Conversation not found',
      );
    });

    it('rejects removing participants from direct conversations', async () => {
      chatRepository.findConversationByIdWithParticipants.mockResolvedValue(createConversation() as never);

      await expectApiError(
        chatService.removeParticipant({
          userId: 'user-1',
          conversationId: 'conversation-1',
          participantUserId: 'user-2',
        }),
        StatusCodes.BAD_REQUEST,
        'Only group conversations can remove participants',
      );
    });

    it('rejects participant removal by users outside the group', async () => {
      chatRepository.findConversationByIdWithParticipants.mockResolvedValue(groupConversation() as never);

      await expectApiError(
        chatService.removeParticipant({
          userId: 'outsider',
          conversationId: 'group-1',
          participantUserId: 'member-1',
        }),
        StatusCodes.FORBIDDEN,
        'You are not a participant of this conversation',
      );
    });

    it('rejects participant removal by non-admin members', async () => {
      chatRepository.findConversationByIdWithParticipants.mockResolvedValue(groupConversation() as never);

      await expectApiError(
        chatService.removeParticipant({
          userId: 'member-1',
          conversationId: 'group-1',
          participantUserId: 'admin-1',
        }),
        StatusCodes.FORBIDDEN,
        'Only group admins can remove participants',
      );
    });

    it('rejects removing a user who is not an active group participant', async () => {
      chatRepository.findConversationByIdWithParticipants.mockResolvedValue(groupConversation() as never);

      await expectApiError(
        chatService.removeParticipant({
          userId: 'admin-1',
          conversationId: 'group-1',
          participantUserId: 'missing-member',
        }),
        StatusCodes.NOT_FOUND,
        'Participant not found in this conversation',
      );
    });

    it('allows removing an admin when another admin remains', async () => {
      chatRepository.findConversationByIdWithParticipants.mockResolvedValue(
        groupConversation({
          participants: [
            createParticipant({ userId: 'admin-1', role: ParticipantRole.ADMIN }),
            createParticipant({ userId: 'admin-2', role: ParticipantRole.ADMIN }),
          ],
        }) as never,
      );
      chatRepository.countConversationAdmins.mockResolvedValue(2 as never);

      const result = await chatService.removeParticipant({
        userId: 'admin-2',
        conversationId: 'group-1',
        participantUserId: 'admin-1',
      });

      expect(chatRepository.removeParticipantFromConversation).toHaveBeenCalledWith({
        conversationId: 'group-1',
        participantUserId: 'admin-1',
      });
      expect(result.participantUserId).toBe('admin-1');
    });

    it('lets a group member leave the conversation', async () => {
      chatRepository.findConversationByIdWithParticipants.mockResolvedValue(groupConversation() as never);

      const result = await chatService.leaveGroupConversation({
        userId: 'member-1',
        conversationId: 'group-1',
      });

      expect(chatRepository.removeParticipantFromConversation).toHaveBeenCalledWith({
        conversationId: 'group-1',
        participantUserId: 'member-1',
      });
      expect(result).toMatchObject({
        conversationId: 'group-1',
        userId: 'member-1',
      });
    });

    it('rejects the last admin leaving the group', async () => {
      chatRepository.findConversationByIdWithParticipants.mockResolvedValue(groupConversation() as never);
      chatRepository.countConversationAdmins.mockResolvedValue(1 as never);

      await expectApiError(
        chatService.leaveGroupConversation({
          userId: 'admin-1',
          conversationId: 'group-1',
        }),
        StatusCodes.BAD_REQUEST,
        'Last admin cannot leave the group',
      );
    });

    it('rejects leaving a missing conversation', async () => {
      chatRepository.findConversationByIdWithParticipants.mockResolvedValue(null as never);

      await expectApiError(
        chatService.leaveGroupConversation({
          userId: 'member-1',
          conversationId: 'missing-group',
        }),
        StatusCodes.NOT_FOUND,
        'Conversation not found',
      );
    });

    it('rejects leaving direct conversations', async () => {
      chatRepository.findConversationByIdWithParticipants.mockResolvedValue(createConversation() as never);

      await expectApiError(
        chatService.leaveGroupConversation({
          userId: 'user-1',
          conversationId: 'conversation-1',
        }),
        StatusCodes.BAD_REQUEST,
        'Only group conversations support leave',
      );
    });

    it('rejects leaving by users outside the group', async () => {
      chatRepository.findConversationByIdWithParticipants.mockResolvedValue(groupConversation() as never);

      await expectApiError(
        chatService.leaveGroupConversation({
          userId: 'outsider',
          conversationId: 'group-1',
        }),
        StatusCodes.FORBIDDEN,
        'You are not a participant of this conversation',
      );
    });

    it('allows an admin to leave when another admin remains', async () => {
      chatRepository.findConversationByIdWithParticipants.mockResolvedValue(
        groupConversation({
          participants: [
            createParticipant({ userId: 'admin-1', role: ParticipantRole.ADMIN }),
            createParticipant({ userId: 'admin-2', role: ParticipantRole.ADMIN }),
          ],
        }) as never,
      );
      chatRepository.countConversationAdmins.mockResolvedValue(2 as never);

      const result = await chatService.leaveGroupConversation({
        userId: 'admin-1',
        conversationId: 'group-1',
      });

      expect(chatRepository.removeParticipantFromConversation).toHaveBeenCalledWith({
        conversationId: 'group-1',
        participantUserId: 'admin-1',
      });
      expect(result.userId).toBe('admin-1');
    });
  });
});
