import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { ChatService } from "../services/chat.service.js";
import { ConversationParamsDTO, conversationParamsSchema, CreateDirectConversationDTO, createDirectConversationSchema, createGroupConversationSchema, CreateGroupeConversationDTO, CursorPaginationDTO, cursorPaginationSchema } from "../validations/chat.validation.js";
import ApiErrorHandler from "../utils/apiErrorHandlerClass.js";
import formatZodError from "../utils/formatZodError.js";

export class ChatController {
  constructor(private readonly chatService: ChatService) {}

    getMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return next(new ApiErrorHandler(StatusCodes.UNAUTHORIZED, "Please login"));
      }

      return res.status(StatusCodes.OK).json({
        success: true,
        data: { userId: req.userId },
      });
    } catch (error) {
      return next(error);
    }
  };

  createDirectConversation = async (
    req: Request<Record<string, any>, any, CreateDirectConversationDTO>, 
    res: Response, 
    next: NextFunction
  ) => {
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

  createGroupConversation = async (
    req: Request<Record<string, never>, any, CreateGroupeConversationDTO>, 
    res: Response, 
    next: NextFunction
  ) => {
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

  getConversationMessages = async (
    req: Request<ConversationParamsDTO, any, never, CursorPaginationDTO>, 
    res: Response, 
    next: NextFunction
  ) => {
    try {
      if (!req.userId) {
        return next(new ApiErrorHandler(StatusCodes.UNAUTHORIZED, "Please login"));
      }

      const safeParams = conversationParamsSchema.safeParse(req.params);
      const safequery = cursorPaginationSchema.safeParse(req.query);
      
      if (!safeParams.success) {
        const errorMessages = formatZodError(safeParams.error);
        throw new ApiErrorHandler(400, errorMessages);
      }

      if (!safequery.success) {
        const errorMessages = formatZodError(safequery.error);
        throw new ApiErrorHandler(400, errorMessages);
      }

      const data = await this.chatService.getConversationMessages({
        userId: req.userId,
        conversationId: safeParams.data.conversationId,
        limit: safequery.data.limit,
        cursorMessageId: safequery.data.cursor,
      });

      return res.status(StatusCodes.OK).json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  };

  markConversationRead = async (
    req: Request<ConversationParamsDTO>, 
    res: Response, 
    next: NextFunction
  ) => {
    try {
      if (!req.userId) {
        return next(new ApiErrorHandler(StatusCodes.UNAUTHORIZED, "Please login"));
      }

      const safeParams = conversationParamsSchema.safeParse(req.params);
      if (!safeParams.success) {
        const errorMessages = formatZodError(safeParams.error);
        throw new ApiErrorHandler(400, errorMessages);
      }

      const data = await this.chatService.markConversationRead({
        userId: req.userId,
        conversationId: safeParams.data.conversationId,
      });

      return res.status(StatusCodes.OK).json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  };
  
}