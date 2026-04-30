import { Router } from 'express';
import { UserController } from './user.controllers.js';
import isAuthenticated from '../../middlewares/isAuthenticated.js';

const userRoutes = (userController: UserController) => {
  const router = Router();

  router.route('/').post(userController.createUser);
  router.route('/profile/me').patch(isAuthenticated, userController.updateMyProfile);
  router.route('/profile/profile-image').patch(isAuthenticated, userController.updateProfileImage);
  router.route('/profile/id/:id').get(userController.getProfileById);
  router.route('/profile/username/:username').get(userController.getProfileByUsername);

  return router;
};

export default userRoutes;
