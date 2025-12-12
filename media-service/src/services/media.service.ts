import MediaServiceEventPublisher from "../events/producer";
import MediaRespository from "../respositories/media.respository";

// media.service.ts
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
    
    await this.mediaServiceEventPublisher.publishProfileImageUpdated(
      secureUrl,
      publicId,
      Number(userId)
    );
  }
}

export default MediaService;