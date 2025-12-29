import { Router } from "express";
import { UserController } from "./user.controllers.js";
import isAuthenticated from "../../middlewares/isAuthenticated.js";


const userRoutes = (userController: UserController) => {

  const router = Router();

  router.route("/").post(userController.createUser);
  router.route("/profile/id/:id").get(userController.getProfileById)
  router.route("/profile/username/:username").get(userController.getProfileByUsername)
  router.route("/profile/profile-image").patch(isAuthenticated, userController.updateProfileImage)
  return router;
}

export default userRoutes;
