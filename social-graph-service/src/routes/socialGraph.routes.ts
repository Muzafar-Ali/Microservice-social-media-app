import { Router } from 'express';
import isAuthenticatedRedis from '../middlewares/isAuthenticatedRedis.middleware.js';
import { SocialGraphController } from '../contorllers/socialGraph.controllers.js';

const socialGrpahRoutes = (socialGraphController: SocialGraphController) => {
  const router = Router();

  router.post('/follow/:targetUserId', isAuthenticatedRedis, socialGraphController.followUser);

  return router;
};

export default socialGrpahRoutes;
