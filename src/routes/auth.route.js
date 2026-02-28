// routes/auth.routes.js
import express from "express";
import AuthController from "../controllers/auth.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

// LOGIN ROUTES
// router.post("/login", AuthController.login);
router.post("/login/researcher", AuthController.researcherLogin);
router.post("/login/reviewer", AuthController.reviewerLogin);
router.post("/login/admin", AuthController.adminLogin);

// Researcher signup 
router.post("/researcher/register", AuthController.researcherRegister);

// Admin signup
router.post("/admin/register", AuthController.createAdminAccount);

// Verify email
router.post("/verify-email", AuthController.verifyEmail);

// Resending verification code
router.post("/resend-verification-code", AuthController.resendVerificationCode);

// Protected
router.get("/check-auth", verifyToken, AuthController.checkAuth);
router.post("/logout", AuthController.logout);

export default router;
