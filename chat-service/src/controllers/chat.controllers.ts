import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { ChatService } from "../services/chat.service.js";
import ApiErrorHandler from "../utils/apiErrorHandlerClass.js";
import {
  AddReactionDto,
  ConversationParamsDto,
  conversationParamsSchema,
  CreateDirectConversationDto,
  CreateGroupConversationDto,
  cursorPaginationSchema,
  DeleteMessageDto,
  MarkConversationReadDto,
  MessageParamsDto,
  messageParamsSchema,
  RemoveReactionDto,
  SendMessageDto,
  UpdateGroupConversationDto,
} from "../validations/chat.validation.js";
import formatZodError from "../utils/formatZodError.js";
import { getSocketServer } from "../socket/index.js";


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
        throw new ApiErrorHandler(StatusCodes.UNAUTHORIZED, "Unauthorized");
      }

      const createdConversation = await this.chatService.createDirectConversation({
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
        throw new ApiErrorHandler(StatusCodes.UNAUTHORIZED, "Unauthorized");
      }

      const createdConversation = await this.chatService.createGroupConversation({
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
        throw new ApiErrorHandler(StatusCodes.UNAUTHORIZED, "Unauthorized");
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
        throw new ApiErrorHandler(StatusCodes.UNAUTHORIZED, "Unauthorized");
      }
      
      const safeParams = conversationParamsSchema.safeParse(req.params);

      if (!safeParams.success) {
        const errorMessages = formatZodError(safeParams.error);
        throw new ApiErrorHandler( StatusCodes.BAD_REQUEST, errorMessages);
      }

      const safeQuery = cursorPaginationSchema.safeParse(req.query);

      if (!safeQuery.success) {
        const errorMessages = formatZodError(safeQuery.error);
        throw new ApiErrorHandler( StatusCodes.BAD_REQUEST, errorMessages);
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
        throw new ApiErrorHandler(StatusCodes.UNAUTHORIZED, "Unauthorized");
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
        const errorMessages = formatZodError(safeParams.error);
        throw new ApiErrorHandler( StatusCodes.BAD_REQUEST, errorMessages);
      }

      const createdMessage = await this.chatService.sendMessage({
        senderId: userId,
        conversationId: safeParams.data.conversationId,
        type,
        body: body ?? null,
        metadata: metadata ?? null,
        clientMessageId,
        replyToMessageId: replyToMessageId ?? null,
        attachments: attachments ?? [],
      });

      const io = getSocketServer();

      io.to(`conversation:${safeParams.data.conversationId}`).emit("chat:message:new", createdMessage);

      io.to(`conversation:${safeParams.data.conversationId}`).emit("conversation:update", {
        conversationId: safeParams.data.conversationId,
        lastMessageId: createdMessage.id,
        lastMessageAt: createdMessage.createdAt,
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
        throw new ApiErrorHandler(StatusCodes.UNAUTHORIZED, "Unauthorized");
      }

      if (!safeParams.success) {
        const errorMessages = formatZodError(safeParams.error);
        throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, errorMessages);
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

  deleteMessage = async (
    req: Request<MessageParamsDto, any, DeleteMessageDto>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req;
      const { forEveryone } = req.body;

      if (!userId) {
        throw new ApiErrorHandler(StatusCodes.UNAUTHORIZED, "Unauthorized");
      }

      const safeParams = messageParamsSchema.safeParse(req.params);

      if (!safeParams.success) {
        const errorMessages = formatZodError(safeParams.error);
        throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, errorMessages);
      }

      const deletedMessage = await this.chatService.deleteMessage({
        userId,
        messageId: safeParams.data.messageId,
        forEveryone,
      });

      res.status(StatusCodes.OK).json({
        success: true,
        message: "Message deleted successfully",
        data: deletedMessage,
      });

    } catch (error) {
      next(error);
    }
  };

  addReaction = async (
    req: Request<MessageParamsDto, any, AddReactionDto>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req;

      if (!userId) {
        throw new ApiErrorHandler(StatusCodes.UNAUTHORIZED, "Unauthorized");
      }

      const safeParams = messageParamsSchema.safeParse(req.params);
    
      if (!safeParams.success) {
        const errorMessage = formatZodError(safeParams.error);
        throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, errorMessage);
      }

      const reaction = await this.chatService.addReaction({
        userId,
        messageId: safeParams.data.messageId,
        reaction: req.body.reaction,
      });

      res.status(StatusCodes.OK).json({
        success: true,
        message: "Reaction added successfully",
        data: reaction,
      });

    } catch (error) {
      next(error);
    }
  };

  removeReaction = async (
    req: Request<MessageParamsDto, any, RemoveReactionDto>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req;
      const { reaction } = req.body;

      if (!userId) {
        throw new ApiErrorHandler(StatusCodes.UNAUTHORIZED, "Unauthorized");
      }

      const safeParams = messageParamsSchema.safeParse(req.params);

      if (!safeParams.success) {
        const errorMessages = formatZodError(safeParams.error);
        throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, errorMessages);
      }

      const removedReaction = await this.chatService.removeReaction({
        userId,
        messageId: safeParams.data.messageId,
        reaction,
      });

      res.status(StatusCodes.OK).json({
        success: true,
        message: "Reaction removed successfully",
        data: removedReaction,
      });

    } catch (error) {
      next(error);
    }
  };

  updateGroupConversation = async (
    req: Request<ConversationParamsDto, any, UpdateGroupConversationDto>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req;
      const { title } = req.body;
      
      if (!userId) {
        throw new ApiErrorHandler(StatusCodes.UNAUTHORIZED, "Unauthorized");
      }

      const safeParams = conversationParamsSchema.safeParse(req.params);

      if (!safeParams.success) {
        const errorMessages = formatZodError(safeParams.error)
        throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, errorMessages);
      }

      const updatedConversation = await this.chatService.updateGroupConversation({
        userId,
        conversationId: safeParams.data.conversationId,
        title,
      });

      const io = getSocketServer();
      io.to(`conversation:${updatedConversation.conversationId}`).emit("chat:group:updated", updatedConversation);

      res.status(StatusCodes.OK).json({
        success: true,
        message: "Group title updated successfully",
        data: updatedConversation,
      });
    } catch (error) {
      next(error);
    }
  };

}