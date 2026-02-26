import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { ChatService } from "../services/chat.service.js";
import { CreateConversationDTO, createConversationSchema } from "../validations/chat.validation.js";
import ApiErrorHandler from "../utils/apiErrorHandlerClass.js";

export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  createConversation = async (req: Request<any, any, CreateConversationDTO>, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return next(new ApiErrorHandler(StatusCodes.UNAUTHORIZED, "Please login"));
      }

      const parsed = createConversationSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(
          new ApiErrorHandler(StatusCodes.BAD_REQUEST, parsed.error.issues.map(i => i.message).join(", "))
        );
      }

      const conversation = await this.chatService.createConversation({
        creatorUserId: req.userId,
        type: parsed.data.type,
        participantUserId: parsed.data.participantUserId,
        title: parsed.data.title,
        participantUserIds: parsed.data.participantUserIds,
      });

      return res.status(StatusCodes.CREATED).json({
        success: true,
        data: conversation,
      });
    } catch (error) {
      return next(error);
    }
  };
}