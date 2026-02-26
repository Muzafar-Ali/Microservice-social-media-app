import { Router } from "express";
import { ChatController } from "../controllers/chat.controllers.js";
import isAuthenticatedRedis from "../middlewares/isAuthenticatedRedis.middleware.js";


export default function chatRoutes(chatController: ChatController) {
  const router = Router();

  // Create conversation (DIRECT/GROUP)
  router.post("/conversations", isAuthenticatedRedis, chatController.createConversation);

  return router;
}