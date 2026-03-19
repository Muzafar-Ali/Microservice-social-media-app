
import isAuthenticated from "../middlewares/isAuthenticated.middleware";
import MediaController from "../controllers/media.controller";
import { Router } from "express";
import validateRequestBody from "../middlewares/validaterequestBody.middleware";
import { postMediaUploadedSchema, postMediaUploadSignatureSchema, profileImageUpdateSchema } from "../schema/media.schema";


const mediaRoutes = (mediaController: MediaController) => {
  const router = Router();

  router.post("/upload/profile-image/signature", mediaController.profileUploadSignatureHanlder);
  router.post("/upload/profile-image/update", isAuthenticated, validateRequestBody(profileImageUpdateSchema), mediaController.profileImageUploadHandler);
  router.post("/upload/media/signature", isAuthenticated, validateRequestBody(postMediaUploadSignatureSchema), mediaController.postMediaUploadSignatureHandler);
  router.post("/upload/media", isAuthenticated, validateRequestBody(postMediaUploadedSchema), mediaController.postMediaUploadHandler);

  return router;
}

export default mediaRoutes;