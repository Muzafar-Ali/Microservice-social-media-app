import { StatusCodes } from "http-status-codes";
import MediaServiceEventPublisher from "../events/producer.js";
import MediaRespository from "../respositories/media.respository.js";
import { PostMediaUploadedDto } from "../validations/media.validation.js";
import ApiErrorHandler from "../utils/apiErrorHandlerClass.js";

class MediaService {
  constructor(
    private mediaRepository: MediaRespository,
    private mediaServiceEventPublisher: MediaServiceEventPublisher
  ) {}

  profileImageUploaded = async (
    userId: string,
    secureUrl: string,
    publicId: string
  ) => {
    
    // await this.mediaServiceEventPublisher.publishProfileImageUpdatedEvent(
    //   secureUrl,
    //   publicId,
    //   userId
    // );
  }

 preparePostMediaPayload =  async (uploadedMedia: PostMediaUploadedDto) => {
    const {
      publicId,
      secureUrl,
      resourceType,
      thumbnailUrl,
      duration,
      width,
      height,
    } = uploadedMedia;

    if (resourceType !== "image" && resourceType !== "video") {
      throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, "Only image and video uploads are allowed");
    }

    return {
      type: resourceType,
      url: secureUrl,
      publicId,
      thumbnailUrl: resourceType === "video" ? thumbnailUrl : undefined,
      duration: resourceType === "video" ? duration : undefined,
      width,
      height,
    };
  };

  // postMediaUpload = async (
  //   userId: string,
  //   postId: string,
  //   secureUrl: string,
  //   publicId: string,
  //   mediType: string,
  // ) => {
    
  //   await this.mediaServiceEventPublisher.publishPostMediaUploadedEvent(
  //     userId, 
  //     postId, 
  //     mediType, 
  //     secureUrl, 
  //     publicId
  //   );
    
  // }
}

export default MediaService;