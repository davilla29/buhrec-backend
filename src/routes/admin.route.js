// routes/adminRoutes.js
import express from "express";
import AdminController from "../controllers/admin.controller.js";
import { uploadReviewerPhoto } from "../middlewares/upload.js";
import { verifyToken, isAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Get all reviewers
router.get("/reviewers", verifyToken, isAdmin, AdminController.getAllReviewers);

// Get all proposals
router.get("/proposals", verifyToken, isAdmin, AdminController.getAllProposals);

// Get all assignments for a particular proposal
router.get(
  "/proposals/:proposalId/assignments",
  verifyToken,
  isAdmin,
  AdminController.listProposalAssignments,
);

// Get assignments list for the tabs
router.get(
  "/assignments/list",
  verifyToken,
  isAdmin,
  AdminController.getAssignmentsList,
);

// Dashboard stats
router.get(
  "/dashboard",
  verifyToken,
  isAdmin,
  AdminController.getDashboardStats,
);

// Get applicant payments list (Supports ?filter=successful or ?filter=pending)
router.get(
  "/payments/list",
  verifyToken,
  isAdmin,
  AdminController.getPaymentsList,
);

// Get reviewers by ID
router.get(
  "/reviewers/:id",
  verifyToken,
  isAdmin,
  AdminController.getReviewerById,
);

// Get all details for a specific proposal for the admin view
router.get(
  "/proposals/:proposalId/details",
  verifyToken,
  isAdmin,
  AdminController.getAdminProposalDetails,
);

// Unassign an active assignment
router.put(
  "/assignments/:assignmentId/unassign",
  verifyToken,
  isAdmin,
  AdminController.unassignAssignment,
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
