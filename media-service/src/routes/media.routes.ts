
import isAuthenticated from "../middlewares/isAuthenticated.middleware";
import MediaController from "../controllers/media.controller";
import { Router } from "express";


const mediaRoutes = (mediaController: MediaController) => {
  const router = Router();

  router.post("/upload/profile-image/signature", mediaController.profileUploadSignatureHanlder);
  router.post("/upload/profile-image/update", isAuthenticated, mediaController.profileImageUploadHandler);
  router.post("/upload/post-video", isAuthenticated, mediaController.postVideoOrImageUploadHandler);

  return router;
}

export default mediaRoutes;