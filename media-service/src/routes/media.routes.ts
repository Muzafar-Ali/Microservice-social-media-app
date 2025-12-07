import MediaController from "@/controllers/media.controller";
import { Router } from "express";


const mediaRoutes = (mediaController: MediaController) => {
  const router = Router();

  router.post("/upload/profile-image/signature", mediaController.profileUploadSignature);
  router.post("/upload/profile-image/update", mediaController.profileUploadSignature);

  return router;
}

export default mediaRoutes;