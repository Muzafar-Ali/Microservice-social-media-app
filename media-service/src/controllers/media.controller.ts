import { ProfileImageUpdateDto, profileImageUpdateSchema } from "../schema/media.schema";
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

  profileImageUploadHandler = async (
    req: Request<{}, {}, ProfileImageUpdateDto>, 
    res: Response, 
    next: NextFunction
  ) => {
  
    try {
    const { userId } = req

    const parsedData = profileImageUpdateSchema.safeParse(req.body);
    if (!parsedData.success) {
      throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, formatZodError(parsedData.error));
    }

    if(!userId) {
      throw new ApiErrorHandler(StatusCodes.UNAUTHORIZED, "Please login");
    }

    // Publihs event for user service
    await this.mediaService.profileImageUploaded(
      userId,
      parsedData.data.secureUrl,
      parsedData.data.publicId,
    );

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Profile image event published successfully",
    });

  } catch (error) {
    next(error);
  }
};


}

export default MediaController;