import { Router } from 'express';
import { AuthController } from './auth.controllers.js';
import isAuthenticatedRedis from '../../middlewares/isAuthenticatedRedis.js';

const authRoutes = (authController: AuthController) => {
  const router = Router();

  router.route('/web/login').post(authController.webLoginHandler);
  router.route('/mobile/login').post(authController.mobileLoginHandler);
  router.route('/web/logout').post(isAuthenticatedRedis, authController.webLogoutHandler);
  router.route('/mobile/logout').post(isAuthenticatedRedis, authController.mobileLogoutHandler);

  return router;
};

export default authRoutes;
