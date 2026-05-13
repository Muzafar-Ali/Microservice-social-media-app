import { Router } from 'express';
import { UserController } from './user.controllers.js';
import isAuthenticatedRedis from '../../middlewares/isAuthenticatedRedis.js';
import validateRequestBody from '../../middlewares/validaterequestBody.middleware.js';
import { createUserSchema, updateMyProfileSchema, updateProfileImageSchema } from './user.validations.js';

const userRoutes = (userController: UserController) => {
  const router = Router();

  router.route('/').post(validateRequestBody(createUserSchema), userController.createUser);
  router.route('/profile/me').patch(isAuthenticatedRedis, validateRequestBody(updateMyProfileSchema), userController.updateMyProfile);
  router.route('/profile/profile-image').patch(isAuthenticatedRedis, validateRequestBody(updateProfileImageSchema), userController.updateProfileImage);
  router.route('/profile/id/:id').get(userController.getProfileById);
  router.route('/profile/username/:username').get(userController.getProfileByUsername);

  return router;
};

export default userRoutes;
