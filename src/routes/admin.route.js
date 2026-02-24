// routes/adminRoutes.js
import express from "express";
import AdminController from "../controllers/admin.controller.js";
import { uploadReviewerPhoto } from "../middlewares/upload.js";
import { verifyToken, isAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Get all reviewers
router.get("/reviewers", verifyToken, isAdmin, AdminController.getAllReviewers);

// Get reviewers by ID
router.get(
  "/reviewers/:id",
  verifyToken,
  isAdmin,
  AdminController.getReviewerById,
);

router.post(
  "/add-reviewer",
  verifyToken,
  isAdmin,
  uploadReviewerPhoto,
  AdminController.addReviewer,
);

// Assign a reviewer to a proposal
router.post(
  "/proposals/:proposalId/assign-reviewer",
  verifyToken,
  isAdmin,
  AdminController.assignReviewerToProposal,
);

router.patch(
  "/reviewers/:id/deactivate",
  verifyToken,
  isAdmin,
  AdminController.deactivateReviewer,
);

router.patch(
  "/reviewers/:id/reactivate",
  verifyToken,
  isAdmin,
  AdminController.reactivateReviewer,
);

router.patch(
  "/review-assignments/:assignmentId/reassign",
  verifyToken,
  isAdmin,
  AdminController.reassignSingleAssignment,
);

export default router;
