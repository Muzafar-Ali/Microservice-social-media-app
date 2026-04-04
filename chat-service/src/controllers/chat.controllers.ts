import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { ChatService } from "../services/chat.service.js";
import ApiErrorHandler from "../utils/apiErrorHandlerClass.js";
import {
  conversationParamsSchema,
  createDirectConversationSchema,
  createGroupConversationSchema,
  cursorPaginationSchema,
  markConversationReadSchema,
  sendMessageSchema,
} from "../validations/chat.validation.js";

type AuthenticatedRequest = Request & {
  userId?: string;
};

export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  private getAuthenticatedUserId(request: AuthenticatedRequest): string {
    if (!request.userId) {
      throw new ApiErrorHandler(
        StatusCodes.UNAUTHORIZED,
        "Unauthorized user"
      );
    }

    return request.userId;
  }

  getMe = async (
    request: AuthenticatedRequest,
    response: Response,
    next: NextFunction
  ) => {
    try {
      const userId = this.getAuthenticatedUserId(request);

      response.status(StatusCodes.OK).json({
        success: true,
        data: {
          userId,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  createDirectConversation = async (
    request: AuthenticatedRequest,
    response: Response,
    next: NextFunction
  ) => {
    try {
      const creatorUserId = this.getAuthenticatedUserId(request);

      const parsedBody = createDirectConversationSchema.safeParse(request.body);

      if (!parsedBody.success) {
        throw new ApiErrorHandler(
          StatusCodes.BAD_REQUEST,
          parsedBody.error.issues[0]?.message ?? "Invalid request body"
        );
      }

      const createdConversation =
        await this.chatService.createDirectConversation({
          creatorUserId,
          type: "DIRECT",
          participantUserId: parsedBody.data.participantUserId,
        });

      response.status(StatusCodes.CREATED).json({
        success: true,
        message: "Direct conversation created successfully",
        data: createdConversation,
      });
    } catch (error) {
      next(error);
    }
  };

  createGroupConversation = async (
    request: AuthenticatedRequest,
    response: Response,
    next: NextFunction
  ) => {
    try {
      const creatorUserId = this.getAuthenticatedUserId(request);

      const parsedBody = createGroupConversationSchema.safeParse(request.body);

      if (!parsedBody.success) {
        throw new ApiErrorHandler(
          StatusCodes.BAD_REQUEST,
          parsedBody.error.issues[0]?.message ?? "Invalid request body"
        );
      }

      const createdConversation =
        await this.chatService.createGroupConversation({
          creatorUserId,
          type: "GROUP",
          title: parsedBody.data.title,
          participantUserIds: parsedBody.data.participantUserIds,
        });

      response.status(StatusCodes.CREATED).json({
        success: true,
        message: "Group conversation created successfully",
        data: createdConversation,
      });
    } catch (error) {
      next(error);
    }
  };

  listMyConversations = async (
    request: AuthenticatedRequest,
    response: Response,
    next: NextFunction
  ) => {
    try {
      const userId = this.getAuthenticatedUserId(request);

      const conversations = await this.chatService.listMyConversations(userId);

      response.status(StatusCodes.OK).json({
        success: true,
        data: conversations,
      });
    } catch (error) {
      next(error);
    }
  };

  getConversationMessages = async (
    request: AuthenticatedRequest,
    response: Response,
    next: NextFunction
  ) => {
    try {
      const userId = this.getAuthenticatedUserId(request);

      const parsedParams = conversationParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        throw new ApiErrorHandler(
          StatusCodes.BAD_REQUEST,
          parsedParams.error.issues[0]?.message ?? "Invalid route params"
        );
      }

      const parsedQuery = cursorPaginationSchema.safeParse(request.query);

      if (!parsedQuery.success) {
        throw new ApiErrorHandler(
          StatusCodes.BAD_REQUEST,
          parsedQuery.error.issues[0]?.message ?? "Invalid query params"
        );
      }

      const paginatedMessages =
        await this.chatService.getConversationMessages({
          userId,
          conversationId: parsedParams.data.conversationId,
          limit: parsedQuery.data.limit,
          cursorMessageId: parsedQuery.data.cursor,
        });

      response.status(StatusCodes.OK).json({
        success: true,
        data: paginatedMessages,
      });
    } catch (error) {
      next(error);
    }
  };

  sendMessage = async (
    request: AuthenticatedRequest,
    response: Response,
    next: NextFunction
  ) => {
    try {
      const senderId = this.getAuthenticatedUserId(request);

      const parsedParams = conversationParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        throw new ApiErrorHandler(
          StatusCodes.BAD_REQUEST,
          parsedParams.error.issues[0]?.message ?? "Invalid route params"
        );
      }

      const parsedBody = sendMessageSchema.safeParse(request.body);

      if (!parsedBody.success) {
        throw new ApiErrorHandler(
          StatusCodes.BAD_REQUEST,
          parsedBody.error.issues[0]?.message ?? "Invalid request body"
        );
      }

      const createdMessage = await this.chatService.sendMessage({
        senderId,
        conversationId: parsedParams.data.conversationId,
        type: parsedBody.data.type,
        body: parsedBody.data.body ?? null,
        metadata: parsedBody.data.metadata as any,
        clientMessageId: parsedBody.data.clientMessageId,
        replyToMessageId: parsedBody.data.replyToMessageId ?? null,
        attachments: parsedBody.data.attachments ?? [],
      });

      response.status(StatusCodes.CREATED).json({
        success: true,
        message: "Message sent successfully",
        data: createdMessage,
      });
    } catch (error) {
      next(error);
    }
  };

  markConversationRead = async (
    request: AuthenticatedRequest,
    response: Response,
    next: NextFunction
  ) => {
    try {
      const userId = this.getAuthenticatedUserId(request);

      const parsedParams = conversationParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        throw new ApiErrorHandler(
          StatusCodes.BAD_REQUEST,
          parsedParams.error.issues[0]?.message ?? "Invalid route params"
        );
      }

      const parsedBody = markConversationReadSchema.safeParse(request.body);

      if (!parsedBody.success) {
        throw new ApiErrorHandler(
          StatusCodes.BAD_REQUEST,
          parsedBody.error.issues[0]?.message ?? "Invalid request body"
        );
      }

      const readState = await this.chatService.markConversationRead({
        userId,
        conversationId: parsedParams.data.conversationId,
        lastReadMessageId: parsedBody.data.lastReadMessageId,
      });

      response.status(StatusCodes.OK).json({
        success: true,
        message: "Conversation marked as read",
        data: readState,
      });
    } catch (error) {
      next(error);
    }
  };
}