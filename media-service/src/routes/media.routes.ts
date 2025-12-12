
import isAuthenticated from "../middlewares/isAuthenticated.middleware";
import MediaController from "../controllers/media.controller";
import { Router } from "express";


const mediaRoutes = (mediaController: MediaController) => {
  const router = Router();

  router.post("/upload/profile-image/signature", mediaController.profileUploadSignatureHanlder);
  router.post("/upload/profile-image/update", isAuthenticated, mediaController.profileImageUploadHandler);

  return router;
}

export default mediaRoutes;