import express from "express";
import AuthController from "../controllers/auth.controller.js";
import {
  verifyToken,
  isReviewer,
  isReviewerActive,
} from "../middlewares/auth.middleware.js";
import {
  updateProfilePhoto,
  uploadReviewerPhoto,
} from "../middlewares/upload.js";
import ReviewerController from "../controllers/reviewer.controller.js";

const router = express.Router();

router.use(verifyToken, isReviewerActive);

router.get("/dashboard", isReviewer, ReviewerController.getReviewerDashboard);

// Get current reviewer profile
router.get("/profile", isReviewer, ReviewerController.getProfile);

// Update profile details (fullName, institution, title, specialization, photo)
router.put(
  "/profile",
  isReviewer,
  updateProfilePhoto,
  ReviewerController.updateProfile,
);

// Update password (requires current password)
router.put("/password", isReviewer, ReviewerController.updatePassword);

router.get("/responses", isReviewer, ReviewerController.getResponses);

// Getting all assignment
router.get("/assignments", isReviewer, ReviewerController.listAssignments);

// Viewing details about a particular assignment
router.get(
  "/assignments/:assignmentId",
  isReviewer,
  ReviewerController.getAssignment,
);

// Accepting an assignment
router.patch(
  "/assignments/:assignmentId/accept",
  isReviewer,
  ReviewerController.acceptAssignment,
);

// Declining an assignment
router.patch(
  "/assignments/:assignmentId/decline",
  isReviewer,
  ReviewerController.declineAssignment,
);

// Viewing the proposal attached to a particular assignment
router.get(
  "/assignments/:assignmentId/proposal",
  isReviewer,
  ReviewerController.getProposalForReview,
);

// Viewing all submitted versions of the proposal
router.get(
  "/assignments/:assignmentId/proposal/versions",
  isReviewer,
  ReviewerController.listSubmittedVersions,
);

// Viewing a particular proposal version
router.get(
  "/assignments/:assignmentId/proposal/version/:versionId",
  isReviewer,
  ReviewerController.getVersionForReview,
);

// Add comments to a particular proposal assignment
router.post(
  "/assignments/:assignmentId/comments",
  isReviewer,
  ReviewerController.addComment,
);

// Get comments for a particular proposal assignment
router.get(
  "/assignments/:assignmentId/comments",
  isReviewer,
  ReviewerController.listComments,
);

//Final decision (approve / reject / request changes)
router.post(
  "/assignments/:assignmentId/decision",
  isReviewer,
  ReviewerController.submitDecision,
);

export default router;
