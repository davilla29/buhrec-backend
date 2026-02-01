// routes/researcherProposalRoutes.js
import express from "express";
import { verifyToken, isResearcher } from "../middlewares/authMiddleware.js";
import { uploadProposalDocs } from "../middlewares/uploadProposalDocs.js";
import { ProposalController } from "../controllers/proposalController.js";

const router = express.Router();

router.use(verifyToken, isResearcher);

// Create proposal shell
router.post("/proposals", ProposalController.createProposal);

// Save draft (version 0)
router.put(
  "/proposals/:proposalId/draft",
  uploadProposalDocs,
  ProposalController.saveDraft,
);

// Start payment (7000 fixed)
router.post(
  "/proposals/:proposalId/payment/init",
  ProposalController.initPayment,
);

// Submit initial version (v1) after paid
router.post("/proposals/:proposalId/submit", ProposalController.submitInitial);

// Versions + comments
router.get("/proposals/:proposalId/versions", ProposalController.listVersions);
router.get(
  "/proposals/:proposalId/versions/:versionNumber/comments",
  ProposalController.getVersionComments,
);

// Submit updated version (v2+)
router.post(
  "/proposals/:proposalId/versions",
  uploadProposalDocs,
  ProposalController.submitUpdatedVersion,
);

export default router;
