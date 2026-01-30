// routes/auth.routes.js
import express from "express";
import {
  login,
  logout,
  refresh,
  forgotPassword,
  resetPassword,
  researcherRegister,
  inviteUser,
  acceptInvite,
} from "../controllers/auth.controller.js";

import { verifyToken, isAdmin } from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * Public/common auth
 */
router.post("/login", login);

// Researcher signup
router.post("/researcher/register", researcherRegister);

router.use(verifyToken);

// Adding reviewer
router.post("/add-reviewer", isAdmin, addReviewer);

// Logout
router.post("/logout", logout);

export default router;
