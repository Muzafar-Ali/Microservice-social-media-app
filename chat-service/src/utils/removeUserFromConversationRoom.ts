import { getSocketServer } from '../socket/index.js';
import logger from './logger.js';

const removeUserFromConversationRoom = (params: { userId: string; conversationId: string }) => {
  const io = getSocketServer();

  const userRoomName = `user:${params.userId}`;
  const conversationRoomName = `conversation:${params.conversationId}`;

  io.in(userRoomName).socketsLeave(conversationRoomName);

  logger.info(
    {
      userId: params.userId,
      conversationId: params.conversationId,
      userRoomName,
      conversationRoomName,
    },
    '🧹 removed user sockets from conversation room',
  );
};

export default removeUserFromConversationRoom;
