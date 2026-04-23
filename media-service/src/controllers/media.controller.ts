import { NextFunction, Request, Response } from 'express';
import { cloudinary } from '../config/cloudinaryClient.js';
import config from '../config/config.js';
import { StatusCodes } from 'http-status-codes';
import ApiErrorHandler from '../utils/apiErrorHandlerClass.js';
import MediaService from '../services/media.service.js';
import {
  PostMediaUploadedDto,
  PostMediaUploadSignatureDto,
  ProfileImageUpdateDto,
} from '../validations/media.validation.js';

class MediaController {
  constructor(private mediaService: MediaService) {}

  profileUploadSignatureHanlder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const timestamp = Math.round(Date.now() / 1000);

      const paramsToSign: Record<string, any> = {
        timestamp,
        folder: 'social-media-app/profile-images',
      };
      const signature = cloudinary.utils.api_sign_request(paramsToSign, config.cloudinaryApiSecret);

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Cloudinary signature generated',
        data: {
          timestamp,
          signature,
          // folder: "profile-images",
          folder: 'social-media-app/profile-images',
          cloudName: config.cloudinaryCloudName,
          apiKey: config.cloudinaryApiKey,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  profileImageUploadHandler = async (
    req: Request<Record<string, any>, any, ProfileImageUpdateDto>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { userId } = req;
      const { publicId, secureUrl } = req.body;

      if (!userId) {
        throw new ApiErrorHandler(StatusCodes.UNAUTHORIZED, 'Please login');
      }

      // Publihs event for user service
      await this.mediaService.profileImageUploaded(userId, secureUrl, publicId);

      res.status(StatusCodes.CREATED).json({
        success: true,
        message: 'Profile image event published successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  postMediaUploadSignatureHandler = async (
    req: Request<Record<string, never>, any, PostMediaUploadSignatureDto>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { type } = req.body;
      const timestamp = Math.round(Date.now() / 1000);

      const uploadFolder = type === 'image' ? 'social-media-app/posts/images' : 'social-media-app/posts/videos';

      const parametersToSign: Record<string, string | number> = {
        timestamp,
        folder: uploadFolder,
      };

      const signature = cloudinary.utils.api_sign_request(parametersToSign, config.cloudinaryApiSecret);

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Post media upload signature generated successfully',
        data: {
          timestamp,
          signature,
          folder: uploadFolder,
          cloudName: config.cloudinaryCloudName,
          apiKey: config.cloudinaryApiKey,
          resourceType: type, // Cloudinary expects image | video
        },
      });
    } catch (error) {
      next(error);
    }
  };

  postMediaUploadHandler = async (
    req: Request<Record<string, never>, any, PostMediaUploadedDto>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { userId } = req;
      if (!userId) {
        throw new ApiErrorHandler(StatusCodes.UNAUTHORIZED, 'Please login');
      }

      const data = req.body;

      const normalizedMediaPayload = await this.mediaService.preparePostMediaPayload(data);

      res.status(StatusCodes.CREATED).json({
        success: true,
        message: 'Post media validated successfully',
        data: normalizedMediaPayload,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default MediaController;
