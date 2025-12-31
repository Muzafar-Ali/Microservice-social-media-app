import MediaServiceEventPublisher from "../events/producer";
import MediaRespository from "../respositories/media.respository";

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
    
    await this.mediaServiceEventPublisher.publishProfileImageUpdatedEvent(
      secureUrl,
      publicId,
      userId
    );
  }

  postMediaUpload = async (
    userId: string,
    postId: string,
    secureUrl: string,
    publicId: string,
    mediType: string,
  ) => {
    
    await this.mediaServiceEventPublisher.publishPostMediaUploadedEvent(
      userId, 
      postId, 
      mediType, 
      secureUrl, 
      publicId
    );
    
  }
}

export default MediaService;