import { postVideoOrImageUpladSchema, PostVideoOrImageUploadDto, ProfileImageUpdateDto, profileImageUpdateSchema } from "../schema/media.schema";
import { cloudinary } from "../config/cloudinaryClient";
import config from "../config/config";
import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import ApiErrorHandler from "../utils/apiErrorHandlerClass";
import formatZodError from "../utils/formatZodError";
import MediaService from "../services/media.service";


class MediaController {
  
  constructor(private mediaService: MediaService) {}
  
  profileUploadSignatureHanlder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const timestamp = Math.round(Date.now() / 1000);
  
      const paramsToSign: Record<string, any> = {
        timestamp,
        folder: "social-media-app/profile-images",
      };
      const signature = cloudinary.utils.api_sign_request(
        paramsToSign,
        config.cloudinaryApiSecret
      );
  
      res.status(StatusCodes.OK).json({
        success: true,
        message: "Cloudinary signature generated",
        data: {
          timestamp,
          signature,
          // folder: "profile-images",
          folder: "social-media-app/profile-images",
          cloudName: config.cloudinaryCloudName,
          apiKey: config.cloudinaryApiKey,
        },
      });
      
    } catch (error) {
      next(error);
    }
  }

  profileImageUploadHandler = async ( req: Request<{}, {}, ProfileImageUpdateDto>, res: Response, next: NextFunction ) => {
    try {
      const { userId } = req

      const validationResult = profileImageUpdateSchema.safeParse(req.body);
      if (!validationResult.success) {
        throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, formatZodError(validationResult.error));
      }

      if(!userId) {
        throw new ApiErrorHandler(StatusCodes.UNAUTHORIZED, "Please login");
      }

      // Publihs event for user service
      await this.mediaService.profileImageUploaded(
        userId,
        validationResult.data.body.secureUrl,
        validationResult.data.body.publicId,
      );

      res.status(StatusCodes.CREATED).json({
        success: true,
        message: "Profile image event published successfully",
      });

    } catch (error) {
      next(error);
    }
  };

  // postVideoOrImageUploadHandler = async ( req: Request<{}, {}, PostVideoOrImageUploadDto["body"]>, res: Response, next: NextFunction ) => {
  //   try {
  //     const { userId } = req

  //     const validationResult = postVideoOrImageUpladSchema.safeParse(req.body);
  //     if (!validationResult.success) {
  //       throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, formatZodError(validationResult.error));
  //     }

  //     if(!userId) {
  //       throw new ApiErrorHandler(StatusCodes.UNAUTHORIZED, "Please login");
  //     }

  //     // Publihs event for user service
  //     await this.mediaService.postMediaUpload(
  //       userId,
  //       validationResult.data.body.postId,
  //       validationResult.data.body.secureUrl,
  //       validationResult.data.body.publicId,
  //       validationResult.data.body.mediaType,
  //     );

  //     res.status(StatusCodes.CREATED).json({
  //       success: true,
  //       message: "Media uplad evenet published successfuly",
  //     });

  //   } catch (error) {
  //     next(error);
  //   }
  // };
}

export default MediaController;