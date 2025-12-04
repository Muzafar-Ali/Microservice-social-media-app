import { Router } from "express";
const authRoutes = (authController) => {
    const router = Router();
    router.route("/login").post(authController.loginHandler);
    return router;
};
export default authRoutes;
