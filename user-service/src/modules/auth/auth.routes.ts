import { Router } from 'express';
import { AuthController } from './auth.controllers.js';
import isAuthenticatedRedis from '../../middlewares/isAuthenticatedRedis.js';
import validateRequestBody from '../../middlewares/validaterequestBody.middleware.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  userLoginSchema,
} from './auth.validations.js';

const authRoutes = (authController: AuthController) => {
  const router = Router();

  router.route('/web/login').post(validateRequestBody(userLoginSchema), authController.webLogin);
  router.route('/mobile/login').post(validateRequestBody(userLoginSchema), authController.mobileLogin);
  router.route('/web/logout').post(isAuthenticatedRedis, authController.webLogout);
  router.route('/mobile/logout').post(isAuthenticatedRedis, authController.mobileLogout);
  router.route('/password/forgot').post(validateRequestBody(forgotPasswordSchema), authController.requestPasswordReset);
  router.route('/password/reset').post(validateRequestBody(resetPasswordSchema), authController.resetPassword);
  router
    .route('/password/change')
    .post(isAuthenticatedRedis, validateRequestBody(changePasswordSchema), authController.changePassword);
  router.route('/sessions').get(isAuthenticatedRedis, authController.getSessions);
  router.route('/sessions/:sessionId').delete(isAuthenticatedRedis, authController.revokeSession);
  router.route('/sessions').delete(isAuthenticatedRedis, authController.revokeAllSessions);

  return router;
};

export default authRoutes;
