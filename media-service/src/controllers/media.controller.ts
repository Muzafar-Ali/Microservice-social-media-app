import { cloudinary } from "@/config/cloudinaryClient";
import config from "@/config/config";
import MediaService from "@/services/media.service";
import ApiErrorHandler from "@/utils/apiErrorHandlerClass";
import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

class MediaController {
  constructor(private mediaService: MediaService ) {}

  profileUploadSignature = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const timestamp = Math.round(Date.now() / 1000);
  
      const paramsToSign: Record<string, any> = {
        timestamp,
        folder: "profile-images",
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
          folder: "profile-images",
          cloudName: config.cloudinaryCloudName,
          apiKey: config.cloudinaryApiKey,
        },
      });
      
    } catch (error) {
      next(error);
    }
  }

}

export default MediaController;