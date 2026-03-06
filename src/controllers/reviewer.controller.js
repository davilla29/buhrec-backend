// controllers/reviewer.controller.js
import mongoose from "mongoose";
import { ReviewAssignment } from "../models/ReviewAssignment.js";
import { Proposal } from "../models/Proposal.js";
import { ProposalVersion } from "../models/ProposalVersion.js";
import { ReviewComment } from "../models/ReviewComment.js";
import { ReviewAssignment } from "../models/ReviewAssignment.js";
import { Reviewer } from "../models/Reviewer.js";
import NotificationController from "./notification.controller.js";

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
  // Get dashboard stats
  static async getReviewerDashboard(req, res) {
    try {
      const reviewerId = req.userId;

      // 1. Fetch Reviewer basic info
      const reviewer = await Reviewer.findById(reviewerId).select("fullName");

      if (!reviewer) {
        return res.status(404).json({ message: "Reviewer not found" });
      }

      // 2. Run queries in parallel
      const [statsData, recentAssignments] = await Promise.all([
        // Aggregate stats based on status
        ReviewAssignment.aggregate([
          { $match: { reviewer: reviewer._id } },
          {
            $group: {
              _id: null,
              accepted: {
                $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] },
              },
              completed: {
                $sum: { $cond: [{ $eq: ["$status", "submitted"] }, 1, 0] },
              },
              incomplete: {
                $sum: {
                  $cond: [
                    { $in: ["$status", ["assigned", "in_progress"]] },
                    1,
                    0,
                  ],
                },
              },
              // Logic for "Pending Feedback" (e.g., assignments needing review action)
              pendingFeedback: {
                $sum: { $cond: [{ $eq: ["$status", "assigned"] }, 1, 0] },
              },
            },
          },
        ]),

        // Fetch the 3 most recent assignments and populate Proposal title
        ReviewAssignment.find({ reviewer: reviewerId })
          .populate("proposal", "title") // Assuming 'Proposal' model has a 'title' field
          .sort({ createdAt: -1 })
          .limit(3),
      ]);

      // Format stats (handle case where no assignments exist yet)
      const stats = statsData[0] || {
        accepted: 0,
        completed: 0,
        incomplete: 0,
        pendingFeedback: 0,
      };

      res.status(200).json({
        success: true,
        user: { name: reviewer.fullName.split(" ")[0] }, // Just the first name for the "Welcome"
        stats,
        recentAssignments: recentAssignments.map((asm) => ({
          id: asm._id,
          title: asm.proposal?.title || "Untitled Proposal",
          status: asm.status,
          date: asm.createdAt,
        })),
      });
    } catch (error) {
      console.error("Dashboard Error:", error);
      res.status(500).json({ message: "Server Error", error: error.message });
    }
  }

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
          select: "title email status stage researcher createdAt updatedAt",
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

  // Accept assignment
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

      // Update proposal status (your exact rule)
      await Proposal.updateOne(
        { _id: assignment.proposal._id },
        {
          $set: {
            status: "Under Review",
            lastStatusChangedBy: reviewerId,
            lastStatusChangedAt: new Date(),
          },
        },
      );

      return res.status(200).json({
        success: true,
        message: "Assignment accepted. Proposal is now Under Review.",
        assignment,
      });
    } catch (error) {
      console.log("acceptAssignment error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // Decline assignment + reason
  static async declineAssignment(req, res) {
    try {
      const { assignmentId } = req.params;
      const reviewerId = req.userId;
      const { reason = "" } = req.body;

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
          message: `Cannot decline assignment in status '${assignment.status}'`,
        });
      }

      assignment.status = "rejected";
      assignment.rejectedAt = new Date();
      assignment.declineReason = String(reason || "").trim();

      await assignment.save();

      return res.status(200).json({
        success: true,
        message: "Assignment declined",
        assignment,
      });
    } catch (error) {
      console.log("declineAssignment error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // Review proposal (loads proposal + latest submitted version)
  static async getProposalForReview(req, res) {
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

      if (
        !["accepted", "in_progress", "submitted"].includes(assignment.status)
      ) {
        return res.status(400).json({
          success: false,
          message: "Accept the assignment before reviewing the proposal",
        });
      }

      // Mark as in progress the first time they open the proposal
      if (assignment.status === "accepted") {
        assignment.status = "in_progress";
        await assignment.save();
      }

      const proposal = await Proposal.findById(assignment.proposal._id).lean();
      if (!proposal) {
        return res
          .status(404)
          .json({ success: false, message: "Proposal not found" });
      }

      const latestVersion = await getLatestSubmittedVersion(proposal._id);
      if (!latestVersion) {
        return res.status(404).json({
          success: false,
          message: "No submitted version found for this proposal",
        });
      }

      // comment count for this version
      const commentCount = await ReviewComment.countDocuments({
        proposal: proposal._id,
        proposalVersion: latestVersion._id,
        isVisibleToResearcher: true,
      });

      return res.status(200).json({
        success: true,
        proposal,
        version: latestVersion,
        commentCount,
        assignment: {
          _id: assignment._id,
          status: assignment.status,
          dueAt: assignment.dueAt,
        },
      });
    } catch (error) {
      console.log("getProposalForReview error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // Review updated proposal: list all submitted versions (latest first)
  static async listSubmittedVersions(req, res) {
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

      if (
        !["accepted", "in_progress", "submitted"].includes(assignment.status)
      ) {
        return res.status(400).json({
          success: false,
          message: "Accept the assignment before viewing versions",
        });
      }

      const versions = await ProposalVersion.find({
        proposal: assignment.proposal._id,
        kind: "submitted",
      })
        .sort({ versionNumber: -1 })
        .select("proposal versionNumber kind changeNote createdAt documents")
        .lean();

      return res.status(200).json({ success: true, versions });
    } catch (error) {
      console.log("listSubmittedVersions error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // Load a specific version for review
  static async getVersionForReview(req, res) {
    try {
      const { assignmentId, versionId } = req.params;
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

      if (!isValidObjectId(versionId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid version id" });
      }

      const version = await ProposalVersion.findOne({
        _id: versionId,
        proposal: assignment.proposal._id,
        kind: "submitted",
      }).lean();

      if (!version) {
        return res
          .status(404)
          .json({ success: false, message: "Version not found" });
      }

      const comments = await ReviewComment.find({
        assignment: assignment._id,
        proposalVersion: version._id,
      })
        .sort({ createdAt: -1 })
        .lean();

      return res.status(200).json({ success: true, version, comments });
    } catch (error) {
      console.log("getVersionForReview error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // Comment on proposal + optionally request changes
  static async addComment(req, res) {
    try {
      const { assignmentId } = req.params;
      const reviewerId = req.userId;

      const {
        proposalVersionId,
        message,
        fieldPath = "",
        severity = "minor",
        requestsChange = false,
      } = req.body;

      if (!proposalVersionId || !isValidObjectId(proposalVersionId)) {
        return res.status(400).json({
          success: false,
          message: "proposalVersionId is required",
        });
      }
      if (!message || !String(message).trim()) {
        return res
          .status(400)
          .json({ success: false, message: "message is required" });
      }

      const assignment = await getReviewerAssignmentOr404(
        assignmentId,
        reviewerId,
      );
      if (!assignment) {
        return res
          .status(404)
          .json({ success: false, message: "Assignment not found" });
      }

      if (
        !["accepted", "in_progress", "submitted"].includes(assignment.status)
      ) {
        return res.status(400).json({
          success: false,
          message: "Accept the assignment before commenting",
        });
      }

      // Ensure version belongs to proposal
      const version = await ProposalVersion.findOne({
        _id: proposalVersionId,
        proposal: assignment.proposal._id,
        kind: "submitted",
      }).lean();

      if (!version) {
        return res
          .status(404)
          .json({ success: false, message: "Proposal version not found" });
      }

      // Mark in progress if needed
      if (assignment.status === "accepted") {
        assignment.status = "in_progress";
        await assignment.save();
      }

      const comment = await ReviewComment.create({
        proposal: assignment.proposal._id,
        proposalVersion: version._id,
        assignment: assignment._id,
        reviewer: reviewerId,
        fieldPath: String(fieldPath || "").trim(),
        message: String(message).trim(),
        severity,
        requestsChange: Boolean(requestsChange),
        isVisibleToResearcher: true,
      });

      return res
        .status(201)
        .json({ success: true, message: "Comment added", comment });
    } catch (error) {
      console.log("addComment error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // List comments for a version
  static async listComments(req, res) {
    try {
      const { assignmentId } = req.params;
      const reviewerId = req.userId;
      const { proposalVersionId } = req.query;

      const assignment = await getReviewerAssignmentOr404(
        assignmentId,
        reviewerId,
      );
      if (!assignment) {
        return res
          .status(404)
          .json({ success: false, message: "Assignment not found" });
      }

      const filter = { assignment: assignment._id };
      if (proposalVersionId) {
        if (!isValidObjectId(proposalVersionId)) {
          return res
            .status(400)
            .json({ success: false, message: "Invalid proposalVersionId" });
        }
        filter.proposalVersion = proposalVersionId;
      }

      const comments = await ReviewComment.find(filter)
        .sort({ createdAt: -1 })
        .lean();

      return res.status(200).json({ success: true, comments });
    } catch (error) {
      console.log("listComments error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // Approve or reject proposal or request changes
  static async submitDecision(req, res) {
    try {
      const { assignmentId } = req.params;
      const reviewerId = req.userId;
      const { decision, reason = "" } = req.body;

      const allowed = ["approve", "reject", "changes_requested"];
      if (!allowed.includes(decision)) {
        return res.status(400).json({
          success: false,
          message: `decision must be one of: ${allowed.join(", ")}`,
        });
      }

      const assignment = await getReviewerAssignmentOr404(
        assignmentId,
        reviewerId,
      );
      if (!assignment) {
        return res
          .status(404)
          .json({ success: false, message: "Assignment not found" });
      }

      if (!["accepted", "in_progress"].includes(assignment.status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot submit decision in status '${assignment.status}'`,
        });
      }

      // Save decision on assignment
      assignment.decision = decision;
      assignment.decisionReason = String(reason || "").trim();
      assignment.decidedAt = new Date();
      assignment.status = "submitted";

      await assignment.save();

      // Map decision -> your Proposal.status
      const now = new Date();
      const proposalSet = {
        lastStatusChangedBy: reviewerId,
        lastStatusChangedAt: now,
      };

      // Clear old timestamps safely
      const proposalUnset = {
        approvedAt: "",
        rejectedAt: "",
      };

      if (decision === "approve") {
        proposalSet.status = "Approved";
        proposalSet.approvedAt = now;
        // don't unset approvedAt
        delete proposalUnset.approvedAt;
      } else if (decision === "reject") {
        proposalSet.status = "Rejected";
        proposalSet.rejectedAt = now;
        delete proposalUnset.rejectedAt;
      } else {
        proposalSet.status = "Awaiting Modifications";
      }

      await Proposal.updateOne(
        { _id: assignment.proposal._id },
        {
          $set: proposalSet,
          $unset: proposalUnset,
          $inc: { reviewCount: 1 },
        },
      );

      // Notify the researcher about the review decision
      if (assignment.proposal?.researcher) {
        let message;
        if (decision === "approve") {
          message = `Your proposal "${assignment.proposal.title}" has been approved by the reviewer.`;
        } else if (decision === "reject") {
          message = `Your proposal "${assignment.proposal.title}" has been rejected by the reviewer.`;
        } else {
          message = `The reviewer has requested changes on your proposal "${assignment.proposal.title}".`;
        }

        await NotificationController.createNotification({
          title: "Proposal Review Update",
          message: message,
          proposalId: assignment.proposal._id,
          senderId: reviewerId, // the reviewer
          senderModel: "Reviewer",
          receiverId: assignment.proposal.researcher, // the researcher
          receiverModel: "Researcher",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Decision submitted successfully",
        assignment,
        proposalStatus: proposalSet.status,
      });
    } catch (error) {
      console.log("submitDecision error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // ==========================================
  // UPDATE REVIEWER PROFILE
  // ==========================================
  static async updateProfile(req, res) {
    try {
      const { fullName, institution, title, specialization } = req.body;

      const reviewer = await Reviewer.findById(req.userId);
      if (!reviewer) {
        return res
          .status(404)
          .json({ success: false, message: "Reviewer not found" });
      }

      // Update allowed fields
      if (fullName) reviewer.fullName = fullName.trim();
      if (institution) reviewer.institution = institution.trim();
      if (title) reviewer.title = title.trim();
      if (specialization) reviewer.specialization = specialization.trim();

      await reviewer.save();

      // Sanitize
      const safeUser = reviewer.toObject();
      delete safeUser.password;
      delete safeUser.verificationToken;
      delete safeUser.verificationTokenExpiresAt;

      return res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        data: safeUser,
      });
    } catch (error) {
      console.error("Update reviewer profile error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  // ==========================================
  // UPDATE REVIEWER PASSWORD
  // ==========================================
  static async updatePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Both current and new passwords are required",
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: "New password must be at least 6 characters long",
        });
      }

      // Need to explicitly select the password field for comparison
      const reviewer = await Reviewer.findById(req.userId).select("+password");
      if (!reviewer) {
        return res
          .status(404)
          .json({ success: false, message: "Reviewer not found" });
      }

      // Verify current password
      const isMatch = await bcrypt.compare(currentPassword, reviewer.password);
      if (!isMatch) {
        return res
          .status(401)
          .json({ success: false, message: "Incorrect current password" });
      }

      // Hash and save new password
      reviewer.password = await bcrypt.hash(newPassword, 12);
      await reviewer.save();

      return res.status(200).json({
        success: true,
        message: "Password updated successfully",
      });
    } catch (error) {
      console.error("Update reviewer password error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
}

export default ReviewerController;
