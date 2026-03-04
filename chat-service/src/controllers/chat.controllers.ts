import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { ChatService } from "../services/chat.service.js";
import { CreateDirectConversationDTO, createDirectConversationSchema, createGroupConversationSchema, CreateGroupeConversationDTO } from "../validations/chat.validation.js";
import ApiErrorHandler from "../utils/apiErrorHandlerClass.js";

export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  createDirectConversation = async (req: Request<any, any, CreateDirectConversationDTO>, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return next(new ApiErrorHandler(StatusCodes.UNAUTHORIZED, "Please login"));
      }

      const parsed = createDirectConversationSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(new ApiErrorHandler(StatusCodes.BAD_REQUEST, parsed.error.issues.map(i => i.message).join(", ")));
      }

      const conversation = await this.chatService.createDirectConversation({
        creatorUserId: req.userId,
        type: "DIRECT",
        participantUserId: parsed.data.participantUserId,
      });

      return res.status(StatusCodes.CREATED).json({
        success: true,
        data: conversation,
      });
    } catch (error) {
      return next(error);
    }
  };

  createGroupConversation = async (req: Request<any, any, CreateGroupeConversationDTO>, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return next(new ApiErrorHandler(StatusCodes.UNAUTHORIZED, "Please login"));
      }

      const parsed = createGroupConversationSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(new ApiErrorHandler(StatusCodes.BAD_REQUEST, parsed.error.issues.map(i => i.message).join(", ")));
      }

      const conversation = await this.chatService.createGroupConversation({
        creatorUserId: req.userId,
        type: "GROUP",
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

  listMyConversations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        throw new ApiErrorHandler(StatusCodes.UNAUTHORIZED, "Please login");
      }

      const conversations = await this.chatService.listMyConversations(req.userId);

     res.status(StatusCodes.OK).json({
        success: true,
        data: conversations,
      });
    } catch (error) {
      return next(error);
    }
  };

  getConversationMessages = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return next(new ApiErrorHandler(StatusCodes.UNAUTHORIZED, "Please login"));
      }

      const conversationId = String(req.params.conversationId);
      const limit = Math.min(Number(req.query.limit ?? 30), 50); // max 50
      const cursorMessageId = req.query.cursor ? String(req.query.cursor) : undefined;

      const data = await this.chatService.getConversationMessages({
        userId: req.userId,
        conversationId,
        limit,
        cursorMessageId,
      });

      return res.status(StatusCodes.OK).json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  };

  markConversationRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return next(new ApiErrorHandler(StatusCodes.UNAUTHORIZED, "Please login"));
      }

      const conversationId = String(req.params.conversationId);

      const data = await this.chatService.markConversationRead({
        userId: req.userId,
        conversationId,
      });

      return res.status(StatusCodes.OK).json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  };
  
}