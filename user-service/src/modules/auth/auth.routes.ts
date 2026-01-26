import { Router } from "express"
import { AuthController } from "./auth.controllers.js";

const authRoutes = (authController: AuthController) => {

  const router = Router();

  router.route("/web/login").post(authController.webLoginHandler);
  router.route("/mobile/login").post(authController.mobileLoginHandler);
  
  return router;
}

export default authRoutes;
