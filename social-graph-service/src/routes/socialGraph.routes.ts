import { Router } from 'express';
import isAuthenticatedRedis from '../middlewares/isAuthenticatedRedis.middleware.js';
import { SocialGraphController } from '../controllers/socialGraph.controllers.js';

const socialGraphRoutes = (socialGraphController: SocialGraphController) => {
  const router = Router();

  router.post('/follow/:targetUserId', isAuthenticatedRedis, socialGraphController.followUser);
  router.delete('/follow/:targetUserId', isAuthenticatedRedis, socialGraphController.unfollowUser);
  router.patch(
    '/follow-requests/:requesterUserId/accept',
    isAuthenticatedRedis,
    socialGraphController.acceptFollowRequest,
  );
  router.delete('/follow-requests/:requesterUserId', isAuthenticatedRedis, socialGraphController.rejectFollowRequest);
  router.get('/users/:targetUserId/followers', isAuthenticatedRedis, socialGraphController.getFollowers);
  router.get('/users/:targetUserId/counts', isAuthenticatedRedis, socialGraphController.getCounts);
  router.get('/me/following/ids', isAuthenticatedRedis, socialGraphController.getMyFollowingUserIds);

  return router;
};

export default socialGraphRoutes;
