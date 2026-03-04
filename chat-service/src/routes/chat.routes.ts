import { Router } from "express";
import { ChatController } from "../controllers/chat.controllers.js";
import isAuthenticatedRedis from "../middlewares/isAuthenticatedRedis.middleware.js";


export default function chatRoutes(chatController: ChatController) {
  const router = Router();

  router.route("/conversations")
  .get(isAuthenticatedRedis, chatController.listMyConversations)
  
  router.route("/conversations/direct")
    .post(isAuthenticatedRedis, chatController.createDirectConversation)
  router.route("/conversations/group")
    .post(isAuthenticatedRedis, chatController.createGroupConversation)

  // Get messages with cursor pagination
  router.get("/conversations/:conversationId/messages", isAuthenticatedRedis, chatController.getConversationMessages);
  // Mark conversation read
  router.post("/conversations/:conversationId/read", isAuthenticatedRedis, chatController.markConversationRead);

  return router;
}