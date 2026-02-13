// routes/researcherProposalRoutes.js
import express from "express";
import { verifyToken, isResearcher } from "../middlewares/auth.middleware.js";
import { uploadProposalDocs } from "../middlewares/uploadProposalDocs.js";
import ResearcherController  from "../controllers/proposal.controller.js";

const router = express.Router();

router.use(verifyToken, isResearcher);

// Create proposal shell
router.post("/proposals", ResearcherController.createProposal);

// Save draft (version 0)
router.put(
  "/proposals/:proposalId/draft",
  uploadProposalDocs,
  ResearcherController.saveDraft,
);

// Start payment (7000 fixed)
router.post(
  "/proposals/:proposalId/payment/init",
  ResearcherController.initPayment,
);

// Submit initial version (v1) after paid
router.post("/proposals/:proposalId/submit", ResearcherController.submitInitial);

// Versions + comments
router.get("/proposals/:proposalId/versions", ResearcherController.listVersions);
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
