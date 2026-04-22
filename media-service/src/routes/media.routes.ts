import MediaController from "../controllers/media.controller.js";
import { Router } from "express";
import validateRequestBody from "../middlewares/validaterequestBody.middleware.js";
import { postMediaUploadedSchema, postMediaUploadSignatureSchema, profileImageUpdateSchema } from "../validations/media.validation.js";
import isAuthenticatedRedis from "../middlewares/isAuthenticatedRedis.middleware.js";


const mediaRoutes = (mediaController: MediaController) => {
  const router = Router();

  router.post("/upload/profile-image/signature", 
    mediaController.profileUploadSignatureHanlder
  );
  router.post("/upload/profile-image/update", 
    isAuthenticatedRedis, 
    validateRequestBody(profileImageUpdateSchema), 
    mediaController.profileImageUploadHandler
  );
  router.post("/upload/media/signature", 
    isAuthenticatedRedis, 
    validateRequestBody(postMediaUploadSignatureSchema), 
    mediaController.postMediaUploadSignatureHandler
  );
  router.post("/upload/media", 
    isAuthenticatedRedis, 
    validateRequestBody(postMediaUploadedSchema), 
    mediaController.postMediaUploadHandler
  );

  return router;
}

export default mediaRoutes;