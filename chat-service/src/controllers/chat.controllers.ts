import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { ChatService } from "../services/chat.service.js";
import ApiErrorHandler from "../utils/apiErrorHandlerClass.js";
import {
  ConversationParamsDto,
  conversationParamsSchema,
  CreateDirectConversationDto,
  CreateGroupConversationDto,
  cursorPaginationSchema,
  MarkConversationReadDto,
  SendMessageDto,
} from "../validations/chat.validation.js";


export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  getMe = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {

      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          userId: req.userId,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  createDirectConversation = async (
    req: Request<Record<string, never>, any, CreateDirectConversationDto>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req;
      const participantUserId = req.body.participantUserId
      
      if (!userId) {
        throw new ApiErrorHandler(401, "Unauthorized");
      }

      const createdConversation =
        await this.chatService.createDirectConversation({
          creatorUserId: userId,
          type: "DIRECT",
          participantUserId
        });

      res.status(StatusCodes.CREATED).json({
        success: true,
        message: "Direct conversation created successfully",
        data: createdConversation,
      });
    } catch (error) {
      next(error);
    }
  };

  createGroupConversation = async (
    req: Request<Record<string, never>, any, CreateGroupConversationDto>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req;
      const { title, participantUserIds } = req.body;

      if (!userId) {
        throw new ApiErrorHandler(401, "Unauthorized");
      }

      const createdConversation =
        await this.chatService.createGroupConversation({
          creatorUserId: userId,
          type: "GROUP",
          title,
          participantUserIds,
        });

      res.status(StatusCodes.CREATED).json({
        success: true,
        message: "Group conversation created successfully",
        data: createdConversation,
      });
    } catch (error) {
      next(error);
    }
  };

  listMyConversations = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req;

      if (!userId) {
        throw new ApiErrorHandler(401, "Unauthorized");
      }

      const conversations = await this.chatService.listMyConversations(userId);

      res.status(StatusCodes.OK).json({
        success: true,
        data: conversations,
      });
    } catch (error) {
      next(error);
    }
  };

  getConversationMessages = async (
    req: Request<ConversationParamsDto>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req
      
      if (!userId) {
        throw new ApiErrorHandler(401, "Unauthorized");
      }
      
      const safeParams = conversationParamsSchema.safeParse(req.params);

      if (!safeParams.success) {
        throw new ApiErrorHandler(
          StatusCodes.BAD_REQUEST,
          safeParams.error.issues[0]?.message ?? "Invalid route params"
        );
      }

      const safeQuery = cursorPaginationSchema.safeParse(req.query);

      if (!safeQuery.success) {
        throw new ApiErrorHandler(
          StatusCodes.BAD_REQUEST,
          safeQuery.error.issues[0]?.message ?? "Invalid query params"
        );
      }

      const paginatedMessages = await this.chatService.getConversationMessages({
          userId,
          conversationId: safeParams.data.conversationId,
          limit: safeQuery.data.limit,
          cursorMessageId: safeQuery.data.cursor,
        });

      res.status(StatusCodes.OK).json({
        success: true,
        data: paginatedMessages,
      });
    } catch (error) {
      next(error);
    }
  };

  sendMessage = async (
    req: Request<ConversationParamsDto, any, SendMessageDto>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req;

      if (!userId) {
        throw new ApiErrorHandler(401, "Unauthorized");
      }

      const safeParams = conversationParamsSchema.safeParse(req.params);
      const {
        attachments,
        clientMessageId,
        type, 
        body,
        metadata,
        replyToMessageId
      } = req.body;

      if (!safeParams.success) {
        throw new ApiErrorHandler(
          StatusCodes.BAD_REQUEST,
          safeParams.error.issues[0]?.message ?? "Invalid route params"
        );
      }

      const createdMessage = await this.chatService.sendMessage({
        senderId: userId,
        conversationId: safeParams.data.conversationId,
        type,
        body: body ?? null,
        metadata,
        clientMessageId,
        replyToMessageId: replyToMessageId ?? null,
        attachments: attachments ?? [],
      });

      res.status(StatusCodes.CREATED).json({
        success: true,
        message: "Message sent successfully",
        data: createdMessage,
      });
    } catch (error) {
      next(error);
    }
  };

  markConversationRead = async (
    req: Request<ConversationParamsDto, any, MarkConversationReadDto>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req;
      const { lastReadMessageId } = req.body;
      const safeParams = conversationParamsSchema.safeParse(req.params);
      
      if (!userId) {
        throw new ApiErrorHandler(401, "Unauthorized");
      }

      if (!safeParams.success) {
        throw new ApiErrorHandler(
          StatusCodes.BAD_REQUEST,
          safeParams.error.issues[0]?.message ?? "Invalid route params"
        );
      }

      const readState = await this.chatService.markConversationRead({
        userId,
        conversationId: safeParams.data.conversationId,
        lastReadMessageId,
      });

      res.status(StatusCodes.OK).json({
        success: true,
        message: "Conversation marked as read",
        data: readState,
      });
    } catch (error) {
      next(error);
    }
  };
}