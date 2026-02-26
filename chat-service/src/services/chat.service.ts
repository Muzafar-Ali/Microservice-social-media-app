import { StatusCodes } from "http-status-codes";
import ApiErrorHandler from "../utils/apiErrorHandlerClass.js";
import { ChatRepository } from "../respositories/chat.repository.js";
import { ConversationResponseDto } from "../types/caht.types.js";
import mapConversation from "../utils/mapConversion.js";

export class ChatService {
  constructor(private readonly chatRepository: ChatRepository) {}

  async createConversation(params: {
    creatorUserId: string;
    type: "DIRECT" | "GROUP";
    participantUserId?: string;
    title?: string;
    participantUserIds?: string[];
  }): Promise<ConversationResponseDto> {

    if (params.type === "DIRECT") {
      if (!params.participantUserId) {
        throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, "participantUserId is required for DIRECT chat");
      }

      if (params.participantUserId === params.creatorUserId) {
        throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, "You cannot create a DIRECT chat with yourself");
      }

      const existing = await this.chatRepository.findExistingDirectConversation(
        params.creatorUserId,
        params.participantUserId
      );

      // If direct conversation already exists, return it instead of creating duplicate.
      if (existing) {
        return mapConversation(existing);
      }

      const created = await this.chatRepository.createDirectConversation(
        params.creatorUserId,
        params.participantUserId
      );

      return mapConversation(created);
    }

    // GROUP:
    const participantUserIds = params.participantUserIds ?? [];
    if (participantUserIds.length === 0) {
      throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, "participantUserIds is required for GROUP chat");
    }

    const created = await this.chatRepository.createGroupConversation({
      creatorUserId: params.creatorUserId,
      title: params.title,
      participantUserIds,
    });

    return mapConversation(created);
  }

}