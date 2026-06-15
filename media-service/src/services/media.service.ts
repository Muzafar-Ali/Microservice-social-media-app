import { StatusCodes } from 'http-status-codes';
import { cloudinary } from '../config/cloudinaryClient.js';
import MediaServiceEventPublisher from '../events/producer.js';
import MediaRespository from '../repositories/media.repository.js';
import { PostMediaUploadedDto } from '../validations/media.validation.js';
import ApiErrorHandler from '../utils/apiErrorHandlerClass.js';

class MediaService {
  private readonly postImageFolderPrefix = 'social-media-app/posts/images/';
  private readonly postVideoFolderPrefix = 'social-media-app/posts/videos/';

  constructor(
    private mediaRepository: MediaRespository,
    private mediaServiceEventPublisher: MediaServiceEventPublisher,
  ) {}

  profileImageUploaded = async (userId: string, secureUrl: string, publicId: string) => {
    // await this.mediaServiceEventPublisher.publishProfileImageUpdatedEvent(
    //   secureUrl,
    //   publicId,
    //   userId
    // );
  };

  preparePostMediaPayload = async (uploadedMedia: PostMediaUploadedDto) => {
    const { publicId, resourceType } = uploadedMedia;

    if (resourceType !== 'image' && resourceType !== 'video') {
      throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, 'Only image and video uploads are allowed');
    }

    const expectedFolderPrefix =
      resourceType === 'image' ? this.postImageFolderPrefix : this.postVideoFolderPrefix;

    if (!publicId.startsWith(expectedFolderPrefix)) {
      throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, 'Uploaded media folder is not allowed');
    }

    const cloudinaryAsset = await cloudinary.api.resource(publicId, {
      resource_type: resourceType,
    });

    if (!cloudinaryAsset?.secure_url || cloudinaryAsset.secure_url !== uploadedMedia.secureUrl) {
      throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, 'Uploaded media could not be verified');
    }

    if (cloudinaryAsset.resource_type !== resourceType) {
      throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, 'Uploaded media type mismatch');
    }

    return {
      type: resourceType,
      url: cloudinaryAsset.secure_url,
      publicId,
      thumbnailUrl: resourceType === 'video' ? uploadedMedia.thumbnailUrl : undefined,
      duration: resourceType === 'video' ? uploadedMedia.duration : undefined,
      width: cloudinaryAsset.width,
      height: cloudinaryAsset.height,
    };
  };
}

export default MediaService;
