// controllers/reviewer.controller.js
import mongoose from "mongoose";
import { ReviewAssignment } from "../models/ReviewAssignment.js";
import { Proposal } from "../models/Proposal.js";
import { ProposalVersion } from "../models/ProposalVersion.js";
import { ReviewComment } from "../models/ReviewComment.js";

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

async function getReviewerAssignmentOr404(assignmentId, reviewerId) {
  if (!isValidObjectId(assignmentId)) return null;

  const assignment = await ReviewAssignment.findOne({
    _id: assignmentId,
    reviewer: reviewerId,
  }).populate({
    path: "proposal",
    select: "title status stage researcher createdAt updatedAt",
  });

  return assignment;
}

async function getLatestSubmittedVersion(proposalId) {
  return ProposalVersion.findOne({
    proposal: proposalId,
    kind: "submitted",
  })
    .sort({ versionNumber: -1 })
    .lean();
}

class ReviewerController {
  /**
   * GET /reviewer/assignments
   * View assignments list
   */
  static async listAssignments(req, res) {
    try {
      const reviewerId = req.userId;

      const assignments = await ReviewAssignment.find({ reviewer: reviewerId })
        .sort({ createdAt: -1 })
        .populate({
          path: "proposal",
          select: "title status stage researcher createdAt updatedAt",
        })
        .lean();

      return res.status(200).json({ success: true, assignments });
    } catch (error) {
      console.log("listAssignments error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /reviewer/assignments/:assignmentId
   * View single assignment detail
   */
  static async getAssignment(req, res) {
    try {
      const { assignmentId } = req.params;
      const reviewerId = req.userId;

      const assignment = await getReviewerAssignmentOr404(
        assignmentId,
        reviewerId,
      );
      if (!assignment) {
        return res
          .status(404)
          .json({ success: false, message: "Assignment not found" });
      }

      return res.status(200).json({ success: true, assignment });
    } catch (error) {
      console.log("getAssignment error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * PATCH /reviewer/assignments/:assignmentId/accept
   * Accept assignment
   */
  static async acceptAssignment(req, res) {
    try {
      const { assignmentId } = req.params;
      const reviewerId = req.userId;

      const assignment = await getReviewerAssignmentOr404(
        assignmentId,
        reviewerId,
      );
      if (!assignment) {
        return res
          .status(404)
          .json({ success: false, message: "Assignment not found" });
      }

      if (assignment.status !== "assigned") {
        return res.status(400).json({
          success: false,
          message: `Cannot accept assignment in status '${assignment.status}'`,
        });
      }

      assignment.status = "accepted";
      assignment.acceptedAt = new Date();
      assignment.declineReason = "";
      assignment.rejectedAt = undefined;

      await assignment.save();

      return res.status(200).json({
        success: true,
        message: "Assignment accepted",
        assignment,
      });
    } catch (error) {
      console.log("acceptAssignment error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * PATCH /reviewer/assignments/:assignmentId/decline
   * Decline assignment + reason
   * body: { reason: "..." }
   */
  static async declineAssignment(req, res) {}

  /**
   * GET /reviewer/assignments/:assignmentId/proposal
   * Review proposal (loads proposal + latest submitted version)
   */
  static async getProposalForReview(req, res) {}

  /**
   * GET /reviewer/assignments/:assignmentId/proposal/versions
   * Review updated proposal: list all submitted versions (latest first)
   */
  static async listSubmittedVersions(req, res) {}

  /**
   * GET /reviewer/assignments/:assignmentId/proposal/version/:versionId
   * Load a specific version for review
   */
  static async getVersionForReview(req, res) {}

  /**
   * POST /reviewer/assignments/:assignmentId/comments
   * Comment on proposal + optionally request changes
   * body: { proposalVersionId, message, fieldPath?, severity?, requestsChange? }
   */
  static async addComment(req, res) {}

  /**
   * GET /reviewer/assignments/:assignmentId/comments?proposalVersionId=...
   * List comments for a version (or all comments for assignment)
   */
  static async listComments(req, res) {}

  /**
   * POST /reviewer/assignments/:assignmentId/decision
   * Approve or reject proposal (or request changes)
   * body: { decision: "approve"|"reject"|"changes_requested", reason? }
   */
  static async submitDecision(req, res) {}
}

export default ReviewerController;
