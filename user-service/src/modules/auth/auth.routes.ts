import { Router } from 'express';
import { AuthController } from './auth.controllers.js';
import isAuthenticatedRedis from '../../middlewares/isAuthenticatedRedis.js';

const authRoutes = (authController: AuthController) => {
  const router = Router();

  router.route('/web/login').post(authController.webLoginHandler);
  router.route('/mobile/login').post(authController.mobileLoginHandler);
  router.route('/web/logout').post(isAuthenticatedRedis, authController.webLogoutHandler);
  router.route('/mobile/logout').post(isAuthenticatedRedis, authController.mobileLogoutHandler);
  router.route('/password/forgot').post(authController.requestPasswordReset);
  router.route('/password/reset').post(authController.resetPassword);
  router.route('/password/change').post(isAuthenticatedRedis, authController.changePassword);
  router.route('/sessions').get(isAuthenticatedRedis, authController.getSessions);
  router.route('/sessions/:sessionId').delete(isAuthenticatedRedis, authController.revokeSession);
  router.route('/sessions').delete(isAuthenticatedRedis, authController.revokeAllSessions);

  return router;
};

export default authRoutes;
