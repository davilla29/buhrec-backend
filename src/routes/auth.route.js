// routes/auth.routes.js
import express from "express";
import AuthController from "../controllers/auth.controller.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Public/common auth
router.post("/login", AuthController.login);

// Researcher signup (matches the UI)
router.post("/researcher/register", AuthController.researcherRegister);

// Verify email
router.post("/verify-email", AuthController.verifyEmail);

// Protected
router.get("/check-auth", verifyToken, AuthController.checkAuth);
router.post("/logout", AuthController.logout);

export default router;
