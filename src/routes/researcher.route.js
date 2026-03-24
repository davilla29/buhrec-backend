import express from "express";
import { verifyToken, isResearcher } from "../middlewares/auth.middleware.js";
import { uploadProposalDocs } from "../middlewares/uploadProposalDocs.js";
import ResearcherController from "../controllers/researcher.controller.js";
import { updateProfilePhoto } from "../middlewares/upload.js";

const router = express.Router();

// To apply authentication and role middleware to all routes below
router.use(verifyToken, isResearcher);

// Get all proposals for the logged-in researcher
router.get("/proposals", ResearcherController.getAllProposals);

// Get specific proposal details (including decision reason)
router.get(
  "/proposals/:proposalId",
  ResearcherController.getProposalStatusAndDecision,
);

// Get details about specific proposal draft
router.get("/proposals/:proposalId/draft", ResearcherController.getDraft);

// Dashboard Route
router.get("/dashboard", ResearcherController.getDashboardStats);

// Create proposal shell
router.post("/create-proposal", ResearcherController.createProposal);

// Save draft (version 0)
router.patch(
  "/proposals/:proposalId/draft",
  uploadProposalDocs,
  ResearcherController.saveDraft,
);

// --- NEW: Get Profile ---
router.get("/profile", ResearcherController.getProfile);

// --- UPDATED: Update profile with Photo Middleware ---
router.put("/profile", updateProfilePhoto, ResearcherController.updateProfile);

// Update password (requires current password)
router.put("/password", ResearcherController.updatePassword);

// Start payment (7000 fixed)
router.post(
  "/proposals/:proposalId/payment/init",
  ResearcherController.initPayment,
);

// Submit initial version (v1) after paid
router.post(
  "/proposals/:proposalId/submit",
  ResearcherController.submitInitial,
);

// Versions + comments
router.get(
  "/proposals/:proposalId/versions",
  ResearcherController.listVersions,
);
router.get(
  "/proposals/:proposalId/versions/:versionNumber/comments",
  ResearcherController.getVersionComments,
);

// Submit updated version (v2+)
router.post(
  "/proposals/:proposalId/versions",
  uploadProposalDocs,
  ResearcherController.submitUpdatedVersion,
);

export default router;
