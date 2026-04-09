import { Router } from "express";
import { ChatController } from "../controllers/chat.controllers.js";
import isAuthenticatedRedis from "../middlewares/isAuthenticatedRedis.middleware.js";
import validateRequestBody from "../middlewares/validateRequestBody.middleware.js";
import { createDirectConversationSchema, createGroupConversationSchema, deleteMessageSchema, markConversationReadSchema, sendMessageSchema } from "../validations/chat.validation.js";


export default function chatRoutes(chatController: ChatController) {
  const router = Router();

  router.route("/conversations").get(isAuthenticatedRedis, chatController.listMyConversations);
  // Simple helper endpoint so the UI can know the current userId (based on sid in Redis)
  router.route("/me").get(isAuthenticatedRedis, chatController.getMe);
  router.route("/conversations/direct").post(isAuthenticatedRedis, validateRequestBody(createDirectConversationSchema), chatController.createDirectConversation);
  router.route("/conversations/group").post(isAuthenticatedRedis, validateRequestBody(createGroupConversationSchema), chatController.createGroupConversation);

  router.route("/conversations/:conversationId/messages")
    .get(isAuthenticatedRedis, chatController.getConversationMessages)
    .post(isAuthenticatedRedis, validateRequestBody(sendMessageSchema), chatController.sendMessage);

  router.route("/conversations/:conversationId/read").post(isAuthenticatedRedis, validateRequestBody(markConversationReadSchema), chatController.markConversationRead);
  router.route("/messages/:messageId").delete(isAuthenticatedRedis, validateRequestBody(deleteMessageSchema), chatController.deleteMessage);

  return router;
}