import MediaServiceEventPublisher from "src/config/events/producer";
import MediaRespository from "src/respositories/media.respository";

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