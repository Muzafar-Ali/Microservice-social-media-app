import { Router } from "express";
import { UserController } from "../controllers/user.controllers.js";

const userRoutes = (userController: UserController) => {

  const router = Router();

  router.route("/").post(userController.createUser);
  router.route("/profile/id/:id").get(userController.getProfileById)
  router.route("/profile/username/:username").get(userController.getProfileByUsername)

  return router;
}

export default userRoutes;
