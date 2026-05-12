import { Router } from 'express';
import { UserController } from './user.controllers.js';
import isAuthenticatedRedis from '../../middlewares/isAuthenticatedRedis.js';

const userRoutes = (userController: UserController) => {
  const router = Router();

  router.route('/').post(userController.createUser);
  router.route('/profile/me').patch(isAuthenticatedRedis, userController.updateMyProfile);
  router.route('/profile/profile-image').patch(isAuthenticatedRedis, userController.updateProfileImage);
  router.route('/profile/id/:id').get(userController.getProfileById);
  router.route('/profile/username/:username').get(userController.getProfileByUsername);

  return router;
};

export default userRoutes;
