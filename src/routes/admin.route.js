// routes/adminRoutes.js
import express from "express";
import { AdminController } from "../controllers/admin.controller.js";
import { uploadReviewerPhoto } from "../middlewares/upload.js";
import { verifyToken, isAdmin } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post(
  "/reviewers",
  verifyToken,
  isAdmin,
  uploadReviewerPhoto,
  AdminController.addReviewer,
);

export default router;
