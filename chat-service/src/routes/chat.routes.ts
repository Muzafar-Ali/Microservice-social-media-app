import { Router } from "express";
import { ChatController } from "../controllers/chat.controllers.js";
import isAuthenticatedRedis from "../middlewares/isAuthenticatedRedis.middleware.js";


export default function chatRoutes(chatController: ChatController) {
  const router = Router();

  router.route("/conversations")
    .post(isAuthenticatedRedis, chatController.createConversation)
    .get(isAuthenticatedRedis, chatController.listMyConversations)

  // // Create conversation (DIRECT/GROUP)
  // router.post("/conversations", isAuthenticatedRedis, chatController.createConversation);
  // // List my conversations
  // router.get("/conversations", isAuthenticatedRedis, chatController.listMyConversations);

  // Get messages with cursor pagination
  router.get("/conversations/:conversationId/messages", isAuthenticatedRedis, chatController.getConversationMessages);
  // Mark conversation read
  router.post("/conversations/:conversationId/read", isAuthenticatedRedis, chatController.markConversationRead);

  return router;
}