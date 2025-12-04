import { Router } from "express"
import { AuthController } from "./auth.controllers.js";

const authRoutes = (authController: AuthController) => {

  const router = Router();

  router.route("/login").post(authController.loginHandler);
  
  return router;
}

export default authRoutes;
