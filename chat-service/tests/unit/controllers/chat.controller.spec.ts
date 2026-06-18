import { jest } from '@jest/globals';
import { ChatController } from '../../../src/controllers/chat.controllers.js';
import ApiErrorHandler from '../../../src/utils/apiErrorHandlerClass.js';
import { MessageType } from '../../../src/generated/prisma/enums.js';
import { getSocketServer } from '../../../src/socket/index.js';
import removeUserFromConversationRoom from '../../../src/utils/removeUserFromConversationRoom.js';

const mockEmit = jest.fn();
const mockTo = jest.fn(() => ({ emit: mockEmit }));
const mockSocketsJoin = jest.fn();
const mockIn = jest.fn(() => ({ socketsJoin: mockSocketsJoin }));

jest.mock('../../../src/socket/index.js', () => ({
  __esModule: true,
  getSocketServer: jest.fn(),
}));

jest.mock('../../../src/utils/removeUserFromConversationRoom.js', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const conversationId = 'conversation-1';
const messageId = 'message-1';
const userId = 'user-1';

const createChatServiceMock = () => ({
  createDirectConversation: jest.fn(),
  createGroupConversation: jest.fn(),
  listMyConversations: jest.fn(),
  getConversationMessages: jest.fn(),
  sendMessage: jest.fn(),
  markConversationRead: jest.fn(),
  deleteMessage: jest.fn(),
  addReaction: jest.fn(),
  removeReaction: jest.fn(),
  updateGroupConversation: jest.fn(),
  addParticipants: jest.fn(),
  removeParticipant: jest.fn(),
  leaveGroupConversation: jest.fn(),
});

const createResponse = () => {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  };

  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);

  return res;
};

const expectNextError = (next: jest.Mock, statusCode: number, message?: string) => {
  expect(next).toHaveBeenCalledTimes(1);
  const error = next.mock.calls[0][0] as ApiErrorHandler;
  expect(error).toMatchObject({ statusCode });
  if (message) expect(error.message).toContain(message);
};

describe('ChatController', () => {
  let chatService: ReturnType<typeof createChatServiceMock>;
  let chatController: ChatController;
  let res: ReturnType<typeof createResponse>;
  let next: jest.Mock;
  const mockGetSocketServer = getSocketServer as jest.MockedFunction<typeof getSocketServer>;
  const mockRemoveUserFromConversationRoom = removeUserFromConversationRoom as jest.MockedFunction<
    typeof removeUserFromConversationRoom
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSocketServer.mockReturnValue({ to: mockTo, in: mockIn } as never);
    chatService = createChatServiceMock();
    chatController = new ChatController(chatService as never);
    res = createResponse();
    next = jest.fn();
  });

  it('returns the authenticated user id from getMe', async () => {
    await chatController.getMe({ userId } as never, res as never, next as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { userId } });
    expect(next).not.toHaveBeenCalled();
  });

  it('creates a direct conversation for the authenticated user', async () => {
    const conversation = { id: conversationId, type: 'DIRECT' };
    chatService.createDirectConversation.mockResolvedValue(conversation as never);

    await chatController.createDirectConversation(
      { userId, body: { participantUserId: 'user-2' } } as never,
      res as never,
      next as never,
    );

    expect(chatService.createDirectConversation).toHaveBeenCalledWith({
      creatorUserId: userId,
      type: 'DIRECT',
      participantUserId: 'user-2',
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Direct conversation created successfully',
      data: conversation,
    });
  });

  it('rejects unauthenticated direct conversation creation', async () => {
    await chatController.createDirectConversation(
      { body: { participantUserId: 'user-2' } } as never,
      res as never,
      next as never,
    );

    expect(chatService.createDirectConversation).not.toHaveBeenCalled();
    expectNextError(next, 401, 'Unauthorized');
  });

  it('creates a group conversation for the authenticated user', async () => {
    const conversation = { id: conversationId, type: 'GROUP' };
    chatService.createGroupConversation.mockResolvedValue(conversation as never);

    await chatController.createGroupConversation(
      { userId, body: { title: 'Team', participantUserIds: ['user-2'] } } as never,
      res as never,
      next as never,
    );

    expect(chatService.createGroupConversation).toHaveBeenCalledWith({
      creatorUserId: userId,
      type: 'GROUP',
      title: 'Team',
      participantUserIds: ['user-2'],
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('rejects unauthenticated group conversation creation', async () => {
    await chatController.createGroupConversation(
      { body: { title: 'Team', participantUserIds: ['user-2'] } } as never,
      res as never,
      next as never,
    );

    expect(chatService.createGroupConversation).not.toHaveBeenCalled();
    expectNextError(next, 401, 'Unauthorized');
  });

  it('lists conversations for the authenticated user', async () => {
    const conversations = [{ id: conversationId }];
    chatService.listMyConversations.mockResolvedValue(conversations as never);

    await chatController.listMyConversations({ userId } as never, res as never, next as never);

    expect(chatService.listMyConversations).toHaveBeenCalledWith(userId);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: conversations });
  });

  it('rejects unauthenticated conversation listing', async () => {
    await chatController.listMyConversations({} as never, res as never, next as never);

    expect(chatService.listMyConversations).not.toHaveBeenCalled();
    expectNextError(next, 401, 'Unauthorized');
  });

  it('loads paginated conversation messages with validated params and query', async () => {
    const messages = { items: [], nextCursor: null };
    chatService.getConversationMessages.mockResolvedValue(messages as never);

    await chatController.getConversationMessages(
      { userId, params: { conversationId }, query: { limit: '10', cursor: 'message-cursor' } } as never,
      res as never,
      next as never,
    );

    expect(chatService.getConversationMessages).toHaveBeenCalledWith({
      userId,
      conversationId,
      limit: 10,
      cursorMessageId: 'message-cursor',
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects invalid message pagination before calling the service', async () => {
    await chatController.getConversationMessages(
      { userId, params: { conversationId }, query: { limit: '51' } } as never,
      res as never,
      next as never,
    );

    expect(chatService.getConversationMessages).not.toHaveBeenCalled();
    expectNextError(next, 400);
  });

  it('rejects unauthenticated conversation message reads', async () => {
    await chatController.getConversationMessages(
      { params: { conversationId }, query: {} } as never,
      res as never,
      next as never,
    );

    expect(chatService.getConversationMessages).not.toHaveBeenCalled();
    expectNextError(next, 401, 'Unauthorized');
  });

  it('rejects invalid conversation id for message reads', async () => {
    await chatController.getConversationMessages(
      { userId, params: { conversationId: '' }, query: {} } as never,
      res as never,
      next as never,
    );

    expect(chatService.getConversationMessages).not.toHaveBeenCalled();
    expectNextError(next, 400);
  });

  it('sends a new message and emits message plus conversation updates', async () => {
    const message = { id: messageId, conversationId, createdAt: '2026-01-01T10:00:00.000Z' };
    chatService.sendMessage.mockResolvedValue({ created: true, message } as never);

    await chatController.sendMessage(
      {
        userId,
        params: { conversationId },
        body: { type: MessageType.TEXT, body: 'Hello', clientMessageId: 'client-1' },
      } as never,
      res as never,
      next as never,
    );

    expect(chatService.sendMessage).toHaveBeenCalledWith({
      senderId: userId,
      conversationId,
      type: MessageType.TEXT,
      body: 'Hello',
      metadata: null,
      clientMessageId: 'client-1',
      replyToMessageId: null,
      attachments: [],
    });
    expect(mockTo).toHaveBeenCalledWith(`conversation:${conversationId}`);
    expect(mockEmit).toHaveBeenCalledWith('chat:message:new', message);
    expect(mockEmit).toHaveBeenCalledWith('conversation:update', {
      conversationId,
      lastMessageId: messageId,
      lastMessageAt: message.createdAt,
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('returns 200 for idempotent message send without emitting socket events', async () => {
    const message = { id: messageId, conversationId, createdAt: '2026-01-01T10:00:00.000Z' };
    chatService.sendMessage.mockResolvedValue({ created: false, message } as never);

    await chatController.sendMessage(
      {
        userId,
        params: { conversationId },
        body: { type: MessageType.TEXT, body: 'Hello', clientMessageId: 'client-1' },
      } as never,
      res as never,
      next as never,
    );

    expect(mockEmit).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Message already sent',
      data: message,
    });
  });

  it('rejects unauthenticated message sends', async () => {
    await chatController.sendMessage(
      { params: { conversationId }, body: { type: MessageType.TEXT, body: 'Hello', clientMessageId: 'client-1' } } as never,
      res as never,
      next as never,
    );

    expect(chatService.sendMessage).not.toHaveBeenCalled();
    expectNextError(next, 401, 'Unauthorized');
  });

  it('rejects invalid conversation id for message sends', async () => {
    await chatController.sendMessage(
      { userId, params: { conversationId: '' }, body: { type: MessageType.TEXT, body: 'Hello', clientMessageId: 'client-1' } } as never,
      res as never,
      next as never,
    );

    expect(chatService.sendMessage).not.toHaveBeenCalled();
    expectNextError(next, 400);
  });

  it('marks a conversation read and emits read update plus ack events', async () => {
    const readState = { conversationId, userId, lastReadMessageId: messageId };
    chatService.markConversationRead.mockResolvedValue(readState as never);

    await chatController.markConversationRead(
      { userId, params: { conversationId }, body: { lastReadMessageId: messageId } } as never,
      res as never,
      next as never,
    );

    expect(chatService.markConversationRead).toHaveBeenCalledWith({ userId, conversationId, lastReadMessageId: messageId });
    expect(mockEmit).toHaveBeenCalledWith('chat:message:read:update', readState);
    expect(mockEmit).toHaveBeenCalledWith('chat:message:read:ack', readState);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects invalid conversation id when marking read', async () => {
    await chatController.markConversationRead(
      { userId, params: { conversationId: '' }, body: { lastReadMessageId: messageId } } as never,
      res as never,
      next as never,
    );

    expect(chatService.markConversationRead).not.toHaveBeenCalled();
    expectNextError(next, 400);
  });

  it('deletes a message and emits deletion plus conversation update when present', async () => {
    const deletedMessage = {
      conversationId,
      messageId,
      conversationUpdate: { conversationId, lastMessageId: 'message-0', lastMessageAt: null },
    };
    chatService.deleteMessage.mockResolvedValue(deletedMessage as never);

    await chatController.deleteMessage(
      { userId, params: { messageId }, body: { forEveryone: true } } as never,
      res as never,
      next as never,
    );

    expect(chatService.deleteMessage).toHaveBeenCalledWith({ userId, messageId, forEveryone: true });
    expect(mockEmit).toHaveBeenCalledWith('chat:message:deleted', deletedMessage);
    expect(mockEmit).toHaveBeenCalledWith('conversation:update', deletedMessage.conversationUpdate);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('deletes a message without emitting conversation update when no update is returned', async () => {
    const deletedMessage = { conversationId, messageId, conversationUpdate: null };
    chatService.deleteMessage.mockResolvedValue(deletedMessage as never);

    await chatController.deleteMessage(
      { userId, params: { messageId }, body: { forEveryone: true } } as never,
      res as never,
      next as never,
    );

    expect(mockEmit).toHaveBeenCalledWith('chat:message:deleted', deletedMessage);
    expect(mockEmit).not.toHaveBeenCalledWith('conversation:update', expect.anything());
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects unauthenticated message deletion', async () => {
    await chatController.deleteMessage({ params: { messageId }, body: { forEveryone: true } } as never, res as never, next as never);

    expect(chatService.deleteMessage).not.toHaveBeenCalled();
    expectNextError(next, 401, 'Unauthorized');
  });

  it('rejects invalid message id for deletion', async () => {
    await chatController.deleteMessage(
      { userId, params: { messageId: '' }, body: { forEveryone: true } } as never,
      res as never,
      next as never,
    );

    expect(chatService.deleteMessage).not.toHaveBeenCalled();
    expectNextError(next, 400);
  });

  it('adds a reaction and emits the reaction event', async () => {
    const reaction = { conversationId, messageId, userId, reaction: 'heart' };
    chatService.addReaction.mockResolvedValue(reaction as never);

    await chatController.addReaction(
      { userId, params: { messageId }, body: { reaction: 'heart' } } as never,
      res as never,
      next as never,
    );

    expect(chatService.addReaction).toHaveBeenCalledWith({ userId, messageId, reaction: 'heart' });
    expect(mockEmit).toHaveBeenCalledWith('chat:message:reaction:added', reaction);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects invalid message id when adding a reaction', async () => {
    await chatController.addReaction(
      { userId, params: { messageId: '' }, body: { reaction: 'heart' } } as never,
      res as never,
      next as never,
    );

    expect(chatService.addReaction).not.toHaveBeenCalled();
    expectNextError(next, 400);
  });

  it('removes a reaction and emits only when a row was removed', async () => {
    const removedReaction = { conversationId, messageId, userId, reaction: 'heart', removed: true };
    chatService.removeReaction.mockResolvedValue(removedReaction as never);

    await chatController.removeReaction(
      { userId, params: { messageId }, body: { reaction: 'heart' } } as never,
      res as never,
      next as never,
    );

    expect(chatService.removeReaction).toHaveBeenCalledWith({ userId, messageId, reaction: 'heart' });
    expect(mockEmit).toHaveBeenCalledWith('chat:message:reaction:removed', removedReaction);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('does not emit reaction removal event when nothing was removed', async () => {
    const removedReaction = { conversationId, messageId, userId, reaction: 'heart', removed: false };
    chatService.removeReaction.mockResolvedValue(removedReaction as never);

    await chatController.removeReaction(
      { userId, params: { messageId }, body: { reaction: 'heart' } } as never,
      res as never,
      next as never,
    );

    expect(mockEmit).not.toHaveBeenCalledWith('chat:message:reaction:removed', removedReaction);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects unauthenticated reaction removal', async () => {
    await chatController.removeReaction({ params: { messageId }, body: { reaction: 'heart' } } as never, res as never, next as never);

    expect(chatService.removeReaction).not.toHaveBeenCalled();
    expectNextError(next, 401, 'Unauthorized');
  });

  it('updates a group conversation and emits update event', async () => {
    const updatedConversation = { conversationId, title: 'New title' };
    chatService.updateGroupConversation.mockResolvedValue(updatedConversation as never);

    await chatController.updateGroupConversation(
      { userId, params: { conversationId }, body: { title: 'New title' } } as never,
      res as never,
      next as never,
    );

    expect(chatService.updateGroupConversation).toHaveBeenCalledWith({ userId, conversationId, title: 'New title' });
    expect(mockEmit).toHaveBeenCalledWith('chat:group:updated', updatedConversation);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('adds group participants, joins their sockets, and emits participant events', async () => {
    const result = { conversationId, participantUserIds: ['user-2', 'user-3'] };
    chatService.addParticipants.mockResolvedValue(result as never);

    await chatController.addParticipants(
      { userId, params: { conversationId }, body: { participantUserIds: ['user-2', 'user-3'] } } as never,
      res as never,
      next as never,
    );

    expect(chatService.addParticipants).toHaveBeenCalledWith({ userId, conversationId, participantUserIds: ['user-2', 'user-3'] });
    expect(mockSocketsJoin).toHaveBeenCalledWith(`conversation:${conversationId}`);
    expect(mockEmit).toHaveBeenCalledWith('chat:group:participant:added', result);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects invalid conversation id when adding participants', async () => {
    await chatController.addParticipants(
      { userId, params: { conversationId: '' }, body: { participantUserIds: ['user-2'] } } as never,
      res as never,
      next as never,
    );

    expect(chatService.addParticipants).not.toHaveBeenCalled();
    expectNextError(next, 400);
  });

  it('removes a group participant, removes sockets from the room, and emits events', async () => {
    const result = { conversationId, participantUserId: 'user-2' };
    chatService.removeParticipant.mockResolvedValue(result as never);

    await chatController.removeParticipant(
      { userId, params: { conversationId, participantUserId: 'user-2' } } as never,
      res as never,
      next as never,
    );

    expect(chatService.removeParticipant).toHaveBeenCalledWith({ userId, conversationId, participantUserId: 'user-2' });
    expect(mockRemoveUserFromConversationRoom).toHaveBeenCalledWith({ userId: 'user-2', conversationId });
    expect(mockEmit).toHaveBeenCalledWith('chat:group:participant:removed', result);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects invalid participant removal params', async () => {
    await chatController.removeParticipant(
      { userId, params: { conversationId, participantUserId: '' } } as never,
      res as never,
      next as never,
    );

    expect(chatService.removeParticipant).not.toHaveBeenCalled();
    expectNextError(next, 400);
  });

  it('leaves a group, removes sockets from the room, and emits events', async () => {
    const result = { conversationId, userId };
    chatService.leaveGroupConversation.mockResolvedValue(result as never);

    await chatController.leaveGroupConversation(
      { userId, params: { conversationId } } as never,
      res as never,
      next as never,
    );

    expect(chatService.leaveGroupConversation).toHaveBeenCalledWith({ userId, conversationId });
    expect(mockRemoveUserFromConversationRoom).toHaveBeenCalledWith({ userId, conversationId });
    expect(mockEmit).toHaveBeenCalledWith('chat:group:left', result);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects invalid conversation params before group update service call', async () => {
    await chatController.updateGroupConversation(
      { userId, params: { conversationId: '' }, body: { title: 'New title' } } as never,
      res as never,
      next as never,
    );

    expect(chatService.updateGroupConversation).not.toHaveBeenCalled();
    expectNextError(next, 400);
  });

  it('rejects unauthenticated group leave before service call', async () => {
    await chatController.leaveGroupConversation({ params: { conversationId } } as never, res as never, next as never);

    expect(chatService.leaveGroupConversation).not.toHaveBeenCalled();
    expectNextError(next, 401, 'Unauthorized');
  });
});
