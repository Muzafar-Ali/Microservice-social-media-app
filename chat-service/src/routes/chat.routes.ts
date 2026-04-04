import { Router } from "express";
import { ChatController } from "../controllers/chat.controllers.js";
import isAuthenticatedRedis from "../middlewares/isAuthenticatedRedis.middleware.js";


export default function chatRoutes(chatController: ChatController) {
  const router = Router();

  router.route("/conversations")
    .get(isAuthenticatedRedis, chatController.listMyConversations);

  // Simple helper endpoint so the UI can know the current userId (based on sid in Redis)
  router.get("/me", isAuthenticatedRedis, chatController.getMe);

  router.route("/conversations/direct")
    .post(isAuthenticatedRedis, chatController.createDirectConversation);

  router.route("/conversations/group")
    .post(isAuthenticatedRedis, chatController.createGroupConversation);

  router.route("/conversations/:conversationId/messages")
    .get(isAuthenticatedRedis, chatController.getConversationMessages)
    .post(isAuthenticatedRedis, chatController.sendMessage);

  router.route("/conversations/:conversationId/read")
    .post(isAuthenticatedRedis, chatController.markConversationRead);

  return router;
}