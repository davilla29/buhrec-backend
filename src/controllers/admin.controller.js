import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Researcher } from "../models/Researcher.js";
import { Proposal } from "../models/Proposal.js";
import { Reviewer } from "../models/Reviewer.js";
import { ReviewAssignment } from "../models/ReviewAssignment.js";
import { Administrator } from "../models/Administrator.js";
import { sendAccountCreationEmail } from "../mail/emailService.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";
import createNotification from "./notification.controller.js";

// small sanitize helper (don’t return password/photo buffer)
const sanitizeReviewer = (r) => ({
  _id: r._id,
  email: r.email,
  fullName: r.fullName,
  institution: r.institution,
  title: r.title,
  specialization: r.specialization,
  yearsOfExperience: r.yearsOfExperience,
  role: r.role,
  isActive: r.isActive,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  // hasPhoto: Boolean(r.photo?.data),
  photoUrl: r.photoUrl || "",
  hasPhoto: Boolean(r.photoUrl),
});

async function emailExistsAnywhere(email) {
  return (
    (await Researcher.exists({ email })) ||
    (await Reviewer.exists({ email })) ||
    (await Administrator.exists({ email }))
  );
}

class AdminController {
  static async addReviewer(req, res) {
    try {
      const {
        fullName,
        email,
        institution,
        title,
        specialization,
        yearsOfExperience,
      } = req.body;

      // Basic validation (matching your UI)
      if (
        !fullName ||
        !email ||
        !institution ||
        !title ||
        !specialization ||
        yearsOfExperience === undefined
      ) {
        return res.status(400).json({
          success: false,
          message:
            "fullName, email, institution, title, specialization, yearsOfExperience are required",
        });
      }

      const yrs = Number(yearsOfExperience);
      if (Number.isNaN(yrs) || yrs < 0) {
        return res.status(400).json({
          success: false,
          message: "yearsOfExperience must be a valid number >= 0",
        });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const exists = await emailExistsAnywhere(normalizedEmail);
      if (exists) {
        return res
          .status(409)
          .json({ success: false, message: "Email already in use" });
      }

      // If a photo was uploaded, it will be in req.file (multer memory storage)
      const photo = req.file
        ? { data: req.file.buffer, contentType: req.file.mimetype }
        : undefined;

      // auto-generate password
      const generatedPassword = crypto.randomBytes(8).toString("base64"); // 16-ish chars
      const hashedPassword = await bcrypt.hash(generatedPassword, 12);

      // Upload photo to cloudinary if included
      let photoUrl = "";
      let photoPublicId = "";

      if (req.file?.buffer) {
        const uploaded = await uploadBufferToCloudinary(req.file.buffer, {
          folder: "buhrec/reviewers", // change to your folder style
          resource_type: "image",
          // optional: force transformations
          // transformation: [{ width: 500, height: 500, crop: "fill" }],
        });

        photoUrl = uploaded.secure_url;
        photoPublicId = uploaded.public_id;
      }

      const reviewer = await Reviewer.create({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        institution: institution.trim(),
        title: title.trim(),
        specialization: specialization.trim(),
        yearsOfExperience: yrs,
        password: hashedPassword,
        ...(photoUrl ? { photoUrl, photoPublicId } : {}),
      });

      // Build frontend login link (exactly how you said)
      const frontendUrl =
        process.env.NODE_ENV === "development"
          ? process.env.FRONTEND_URL_DEV
          : process.env.FRONTEND_URL_PROD;

      const loginLink = `${frontendUrl}/reviewer/login`;

      // ✅ Email reviewer their account details
      try {
        await sendAccountCreationEmail({
          fullName: reviewer.fullName,
          userEmail: reviewer.email,
          generatedPassword,
          loginLink,
        });
      } catch (mailErr) {
        // If email fails, you may choose to keep the account but notify admin
        console.error("Failed to send reviewer email:", mailErr);

        return res.status(201).json({
          success: true,
          message:
            "Reviewer created, but failed to send email. Please contact the reviewer manually or retry.",
          data: sanitizeReviewer(reviewer),
          emailSent: false,
        });
      }

      return res.status(201).json({
        success: true,
        message: "Reviewer created successfully and email sent",
        data: sanitizeReviewer(reviewer),
        emailSent: true,
      });
    } catch (error) {
      // Multer fileFilter errors often come as Error with message you set
      if (error?.message?.includes("Only JPG, PNG, or WEBP")) {
        return res.status(400).json({ success: false, message: error.message });
      }

      console.error("Add reviewer error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  static async getAllReviewers(req, res) {
    try {
      // basic reviewer info
      const reviewers = await Reviewer.find({ isActive: true })
        .select("fullName title specialization institution photoUrl createdAt")
        .lean();

      // OPTIONAL: attach ongoing assignments count
      const reviewerIds = reviewers.map((r) => r._id);

      const ongoingCounts = await ReviewAssignment.aggregate([
        {
          $match: {
            reviewer: { $in: reviewerIds },
            status: "ongoing",
          },
        },
        {
          $group: {
            _id: "$reviewer",
            count: { $sum: 1 },
          },
        },
      ]);

      const countMap = Object.fromEntries(
        ongoingCounts.map((c) => [c._id.toString(), c.count]),
      );

      const data = reviewers.map((r) => ({
        ...r,
        ongoingAssignments: countMap[r._id.toString()] || 0,
      }));

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      console.error("Get reviewers error:", error);
      return res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }

  static async getReviewerById(req, res) {
    try {
      const { id } = req.params;

      const reviewer = await Reviewer.findById(id)
        .select(
          "fullName email title specialization institution yearsOfExperience photoUrl isActive createdAt",
        )
        .lean();

      if (!reviewer) {
        return res.status(404).json({
          success: false,
          message: "Reviewer not found",
        });
      }

      // Assignment statistics
      const stats = await Assignment.aggregate([
        {
          $match: { reviewer: reviewer._id },
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]);

      const statsMap = {
        accepted: 0,
        completed: 0,
        incomplete: 0,
        pendingFeedback: 0,
      };

      stats.forEach((s) => {
        if (s._id === "accepted") statsMap.accepted = s.count;
        if (s._id === "completed") statsMap.completed = s.count;
        if (s._id === "incomplete") statsMap.incomplete = s.count;
        if (s._id === "pending_feedback") statsMap.pendingFeedback = s.count;
      });

      return res.status(200).json({
        success: true,
        data: {
          ...reviewer,
          statistics: statsMap,
        },
      });
    } catch (error) {
      console.error("Get reviewer details error:", error);
      return res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }

  // Assign a reviewer to a proposal
  static async assignReviewerToProposal(req, res) {
    try {
      const { proposalId } = req.params;
      const { reviewerId, dueAt } = req.body;

      if (!reviewerId) {
        return res.status(400).json({
          success: false,
          message: "reviewerId is required",
        });
      }

      const proposal = await Proposal.findById(proposalId);
      if (!proposal) {
        return res.status(404).json({
          success: false,
          message: "Proposal not found",
        });
      }

      // Proposal must be paid/submitted-ish before assigning
      // Adjust if your flow allows assignment at other stages
      const assignableStatuses = [
        "Paid",
        "Waiting to be assigned",
        "Under Review",
      ];
      if (!assignableStatuses.includes(proposal.status)) {
        return res.status(400).json({
          success: false,
          message: `Proposal cannot be assigned in status '${proposal.status}'`,
        });
      }

      const reviewer = await Reviewer.findById(reviewerId).select(
        "isActive fullName email",
      );
      if (!reviewer || !reviewer.isActive) {
        return res.status(400).json({
          success: false,
          message: "Reviewer must exist and be active",
        });
      }

      // Prevent duplicates
      const existing = await ReviewAssignment.findOne({
        proposal: proposal._id,
        reviewer: reviewer._id,
      }).lean();

      if (existing) {
        return res.status(409).json({
          success: false,
          message: "This reviewer is already assigned to this proposal",
        });
      }

      // Create assignment
      const assignment = await ReviewAssignment.create({
        proposal: proposal._id,
        reviewer: reviewer._id,
        status: "assigned",
        assignedBy: req.userId, // admin id
        assignedAt: new Date(),
        ...(dueAt ? { dueAt: new Date(dueAt) } : {}),
      });

      // Update proposal meta
      // Once assigned (but not yet accepted), proposal should be "Waiting to be assigned"
      const now = new Date();
      proposal.status = "Waiting to be assigned";
      proposal.assignedAt = now;
      proposal.lastStatusChangedBy = reviewer._id; // optional: you can also set admin id if you want
      proposal.lastStatusChangedAt = now;

      await proposal.save();

      // Notify reviewer of the assignment
      await createNotification({
        title: "New Proposal Assigned",
        message: `You have been assigned to review the proposal "${proposal.title}". Please check your dashboard for details.`,
        proposalId: proposal._id,
        senderId: req.userId,
        receiverId: reviewer._id,
      });

      return res.status(201).json({
        success: true,
        message: "Reviewer assigned successfully",
        data: {
          assignment,
          proposal: {
            _id: proposal._id,
            title: proposal.title,
            applicationId: proposal.applicationId,
            status: proposal.status,
            assignedAt: proposal.assignedAt,
          },
          reviewer: {
            _id: reviewer._id,
            fullName: reviewer.fullName,
            email: reviewer.email,
          },
        },
      });
    } catch (error) {
      console.error("assignReviewerToProposal error:", error);

      // Handle duplicate key error from schema unique index
      if (error?.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "Duplicate assignment not allowed",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }

  // View assignments for a proposal
  static async listProposalAssignments(req, res) {
    try {
      const { proposalId } = req.params;

      const proposal = await Proposal.findById(proposalId).select(
        "title applicationId status",
      );
      if (!proposal) {
        return res
          .status(404)
          .json({ success: false, message: "Proposal not found" });
      }

      const assignments = await ReviewAssignment.find({ proposal: proposalId })
        .populate(
          "reviewer",
          "fullName email institution title specialization isActive photoUrl",
        )
        .sort({ createdAt: -1 })
        .lean();

      return res.status(200).json({ success: true, proposal, assignments });
    } catch (error) {
      console.error("listProposalAssignments error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  static async deactivateReviewer(req, res) {
    try {
      const { id } = req.params;

      const reviewer = await Reviewer.findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true },
      ).select("fullName isActive");

      if (!reviewer) {
        return res.status(404).json({
          success: false,
          message: "Reviewer not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Reviewer deactivated successfully",
        data: reviewer,
      });
    } catch (error) {
      console.error("Deactivate reviewer error:", error);
      return res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }

  static async reactivateReviewer(req, res) {
    try {
      const { id } = req.params;

      const reviewer = await Reviewer.findByIdAndUpdate(
        id,
        { isActive: true },
        { new: true },
      ).select("fullName isActive");

      if (!reviewer) {
        return res.status(404).json({
          success: false,
          message: "Reviewer not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Reviewer reactivated successfully",
        data: reviewer,
      });
    } catch (error) {
      console.error("Reactivate reviewer error:", error);
      return res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }

  static async reassignSingleAssignment(req, res) {
    try {
      const { assignmentId } = req.params;
      const { newReviewerId } = req.body;

      if (!newReviewerId) {
        return res.status(400).json({
          success: false,
          message: "newReviewerId is required",
        });
      }

      const newReviewer = await Reviewer.findById(newReviewerId);
      if (!newReviewer || !newReviewer.isActive) {
        return res.status(400).json({
          success: false,
          message: "New reviewer must exist and be active",
        });
      }

      const assignment = await ReviewAssignment.findById(assignmentId);

      if (!assignment) {
        return res.status(404).json({
          success: false,
          message: "Assignment not found",
        });
      }

      if (["submitted", "rejected", "withdrawn"].includes(assignment.status)) {
        return res.status(400).json({
          success: false,
          message: "This assignment can no longer be reassigned",
        });
      }

      assignment.reviewer = newReviewerId;
      assignment.assignedAt = new Date();

      await assignment.save();

      return res.status(200).json({
        success: true,
        message: "Assignment reassigned successfully",
        data: assignment,
      });
    } catch (error) {
      console.error("Reassign single assignment error:", error);
      return res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
}

export default AdminController;
