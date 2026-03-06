// View, Accept and Reject assignment and add reason if declining
// Review proposal
// Comment on proposal and request for changes
// Review updated proposal
// Approve or reject proposal
// View notifications

// routes/reviewer.routes.js
import express from "express";
import AuthController from "../controllers/auth.controller.js";
import { verifyToken, isReviewer } from "../middlewares/auth.middleware.js";
import ReviewerController from "../controllers/reviewer.controller.js";

const router = express.Router();

router.get("/dashboard",  verifyToken, isReviewer, ReviewerController.getReviewerDashboard);

// Getting all assignment
router.get(
  "/assignments",
  verifyToken,
  isReviewer,
  ReviewerController.listAssignments,
);

// Viewing details about a particular assignment
router.get(
  "/assignments/:assignmentId",
  verifyToken,
  isReviewer,
  ReviewerController.getAssignment,
);

// Accepting an assignment
router.patch(
  "/assignments/:assignmentId/accept",
  verifyToken,
  isReviewer,
  ReviewerController.acceptAssignment,
);

// Declining an assignment
router.patch(
  "/assignments/:assignmentId/decline",
  verifyToken,
  isReviewer,
  ReviewerController.declineAssignment,
);

// Update profile details (fullName, institution, title, specialization)
router.put("/profile", verifyToken, ReviewerController.updateProfile);

// Update password (requires current password)
router.put("/password", verifyToken, ReviewerController.updatePassword);

// Viewing the proposal attached to a particular assignment
router.get(
  "/assignments/:assignmentId/proposal",
  verifyToken,
  isReviewer,
  ReviewerController.getProposalForReview,
);

// Viewing all submitted versions of the proposal
router.get(
  "/assignments/:assignmentId/proposal/versions",
  verifyToken,
  isReviewer,
  ReviewerController.listSubmittedVersions,
);

// Viewing a particular proposal version
router.get(
  "/assignments/:assignmentId/proposal/version/:versionId",
  verifyToken,
  isReviewer,
  ReviewerController.getVersionForReview,
);

// Add comments to a particular proposal assignment
router.post(
  "/assignments/:assignmentId/comments",
  verifyToken,
  isReviewer,
  ReviewerController.addComment,
);

// Get comments for a particular proposal assignment
router.get(
  "/assignments/:assignmentId/comments",
  verifyToken,
  isReviewer,
  ReviewerController.listComments,
);

//Final decision (approve / reject / request changes)
router.post(
  "/assignments/:assignmentId/decision",
  verifyToken,
  isReviewer,
  ReviewerController.submitDecision,
);

export default router;
