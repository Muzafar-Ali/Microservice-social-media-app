import { Router } from 'express';
import isAuthenticatedRedis from '../middlewares/isAuthenticatedRedis.middleware.js';
import { SocialGraphController } from '../contorllers/socialGraph.controllers.js';

const socialGraphRoutes = (socialGraphController: SocialGraphController) => {
  const router = Router();

  router.post('/follow/:targetUserId', isAuthenticatedRedis, socialGraphController.followUser);
  router.delete('/follow/:targetUserId', isAuthenticatedRedis, socialGraphController.unfollowUser);
  router.get('/users/:userId/followers', isAuthenticatedRedis, socialGraphController.getFollowers);

  return router;
};

export default socialGraphRoutes;
