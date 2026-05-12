import { Router } from 'express';
import { AuthController } from './auth.controllers.js';

const authRoutes = (authController: AuthController) => {
  const router = Router();

  router.route('/web/login').post(authController.webLoginHandler);
  router.route('/mobile/login').post(authController.mobileLoginHandler);
  router.route('/web/logout').post(authController.webLogoutHandler);
  router.route('/mobile/logout').post(authController.mobileLogoutHandler);

  return router;
};

export default authRoutes;
