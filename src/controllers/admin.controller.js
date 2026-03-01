import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Researcher } from "../models/Researcher.js";
import { Proposal } from "../models/Proposal.js";
import { Reviewer } from "../models/Reviewer.js";
import { ReviewAssignment } from "../models/ReviewAssignment.js";
import { Administrator } from "../models/Administrator.js";
import { sendAccountCreationEmail } from "../mail/emailService.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";
import NotificationController from "./notification.controller.js";

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
  // ==========================================
  // ADMIN DASHBOARD STATS
  // ==========================================
  static async getDashboardStats(req, res) {
    try {
      const { timeframe } = req.query;

      // 1. Calculate the date filter based on the requested timeframe
      let startDate = new Date(0); // Default to beginning of time (all time)
      const now = new Date();

      if (timeframe === "this_week") {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
      } else if (timeframe === "this_month") {
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
      } else if (timeframe === "last_3_months") {
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 3);
      } else if (timeframe === "last_6_months") {
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 6);
      }

      const dateFilter = timeframe ? { createdAt: { $gte: startDate } } : {};

      // 2. Query Proposal Statistics
      // Unassigned: Proposals that are paid/submitted but waiting for a reviewer
      const unassignedAssignmentsCount = await Proposal.countDocuments({
        ...dateFilter,
        status: "Waiting to be assigned",
      });

      // New Applications: All proposals submitted (not Draft or Awaiting Payment)
      const newApplicationsCount = await Proposal.countDocuments({
        ...dateFilter,
        status: { $nin: ["Draft", "Awaiting Payment"] },
      });

      // UG / PG Submissions
      // (Assuming you save 'category' on the Proposal model when submitting.
      // If it's stored inside ProposalVersion formData, you will need an aggregation pipeline instead).
      const ugSubmissionsCount = await Proposal.countDocuments({
        ...dateFilter,
        category: { $in: ["Undergraduate", "UG"] },
        status: { $nin: ["Draft", "Awaiting Payment"] },
      });

      const pgSubmissionsCount = await Proposal.countDocuments({
        ...dateFilter,
        category: { $in: ["Postgraduate", "PG"] },
        status: { $nin: ["Draft", "Awaiting Payment"] },
      });

      // 3. Query Assignment Statistics
      // Assigned: Reviewer has it, but hasn't submitted a decision yet
      const assignedAssignmentsCount = await ReviewAssignment.countDocuments({
        ...dateFilter,
        status: { $in: ["assigned", "accepted", "in_progress"] },
      });

      // Completed: Reviewer submitted their final decision
      const completedAssignmentsCount = await ReviewAssignment.countDocuments({
        ...dateFilter,
        status: "submitted",
      });

      // Incomplete: Could mean assignments that were rejected/withdrawn, or proposals returned for modifications.
      // We will count proposals currently "Awaiting Modifications" as incomplete.
      const incompleteAssignmentsCount = await Proposal.countDocuments({
        ...dateFilter,
        status: "Awaiting Modifications",
      });

      return res.status(200).json({
        success: true,
        data: {
          topStats: {
            unassignedAssignments: unassignedAssignmentsCount,
            assignedAssignments: assignedAssignmentsCount,
            completedAssignments: completedAssignmentsCount,
            incompleteAssignments: incompleteAssignmentsCount,
          },
          applicationStats: {
            ugSubmissions: ugSubmissionsCount,
            pgSubmissions: pgSubmissionsCount,
            newApplications: newApplicationsCount,
          },
          // For the bottom banner
          unassignedBannerCount: unassignedAssignmentsCount,
        },
      });
    } catch (error) {
      console.error("Admin dashboard stats error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

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

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format",
        });
      }

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
          title: reviewer.title,
          generatedPassword,
          loginLink,
          profileImageUrl: photoUrl || null,
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

  // To list all reviewers and the number of their ongoing assignment
  static async getAllReviewers(req, res) {
    try {
      // basic reviewer info
      const reviewers = await Reviewer.find()
        .select(
          "fullName title email isActive specialization institution photoUrl createdAt",
        )
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

  // To get specific details about a reviewer
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

  // Get all proposals
  static async getAllProposals(req, res) {
    try {
      // Find all proposals matching the logged-in user's ID
      // Sorting by updatedAt descending ensures the most recently modified ones appear first
      const proposals = await Proposal.find().sort({ updatedAt: -1 }).lean();

      return res.status(200).json({
        success: true,
        count: proposals.length,
        proposals,
      });
    } catch (err) {
      console.log("getAllProposals error:", err);
      return res.status(500).json({ success: false, message: err.message });
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

      // 1. Check if there's any active assignment (anything NOT rejected)
      const activeAssignment = await ReviewAssignment.findOne({
        proposal: proposal._id,
        status: { $ne: "rejected" }, // 'assigned', 'accepted', 'in_progress', 'submitted', etc.
      }).lean();

      if (activeAssignment) {
        return res.status(409).json({
          success: false,
          message: `This proposal is currently assigned to someone else (Status: ${activeAssignment.status}). You can only assign a new reviewer if the previous reviewer rejected the assignment.`,
        });
      }

      // 2. Prevent assigning it back to the SAME reviewer who rejected it
      const previouslyRejected = await ReviewAssignment.findOne({
        proposal: proposal._id,
        reviewer: reviewer._id,
        status: "rejected",
      }).lean();

      if (previouslyRejected) {
        return res.status(409).json({
          success: false,
          message:
            "This reviewer previously rejected this proposal. Please select a different reviewer.",
        });
      }

      // // Prevent duplicates
      // const existing = await ReviewAssignment.findOne({
      //   proposal: proposal._id,
      //   reviewer: reviewer._id,
      // }).lean();

      // if (existing) {
      //   return res.status(409).json({
      //     success: false,
      //     message: "This reviewer is already assigned to this proposal",
      //   });
      // }

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
      await NotificationController.createNotification({
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

  // View assignments for a specific proposal
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

  // GET ALL ASSIGNMENTS
  static async getAssignmentsList(req, res) {
    try {
      // filter can be 'unassigned', 'assigned', 'completed', or 'all'
      const { filter = "all" } = req.query;
      const fetchAll = filter === "all";

      let responseData = {};

      // 1. UNASSIGNED: Proposals waiting for a reviewer
      // Fetching from Proposal model because no assignment exists yet
      if (fetchAll || filter === "unassigned") {
        const unassigned = await Proposal.find({
          status: { $in: ["Paid", "Waiting to be assigned"] }, // Adjust statuses as needed
        })
          .populate("researcher", "fullName email")
          .sort({ updatedAt: -1 })
          .lean();

        responseData.unassigned = unassigned;
      }

      // 2. ASSIGNED: Active ReviewAssignments
      if (fetchAll || filter === "assigned") {
        const assigned = await ReviewAssignment.find({
          status: { $in: ["assigned", "accepted", "in_progress"] },
        })
          .populate("proposal", "title status applicationId")
          .populate("reviewer", "fullName email photoUrl")
          .sort({ assignedAt: -1 })
          .lean();

        responseData.assigned = assigned;
      }

      // 3. COMPLETED: Finished ReviewAssignments
      if (fetchAll || filter === "completed") {
        const completed = await ReviewAssignment.find({
          status: "submitted",
        })
          .populate("proposal", "title status applicationId")
          .populate("reviewer", "fullName email photoUrl")
          .sort({ decidedAt: -1, updatedAt: -1 }) // Sort by when they made the decision
          .lean();

        responseData.completed = completed;
      }

      return res.status(200).json({
        success: true,
        // If 'all', return the grouped object. Otherwise, return just the requested array
        data: fetchAll ? responseData : responseData[filter],
      });
    } catch (error) {
      console.error("getAssignmentsList error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  // To deactivate a reviewer
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

  // To reactivate a reviewer
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

  // To handle a situation where a reviewer accepted the proposal but is taking too long and the admin needs to forcibly take it away from them and give it to someone else.
  static async reassignSingleAssignment(req, res) {
    try {
      const { assignmentId } = req.params;
      const { newReviewerId, dueAt } = req.body;

      if (!newReviewerId) {
        return res.status(400).json({
          success: false,
          message: "newReviewerId is required",
        });
      }

      // 1. Validate the old assignment
      const oldAssignment = await ReviewAssignment.findById(assignmentId);
      if (!oldAssignment) {
        return res.status(404).json({
          success: false,
          message: "Original assignment not found",
        });
      }

      if (["submitted", "withdrawn"].includes(oldAssignment.status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot reassign. The current assignment is already marked as '${oldAssignment.status}'`,
        });
      }

      // 2. Validate the new reviewer
      const newReviewer = await Reviewer.findById(newReviewerId);
      if (!newReviewer || !newReviewer.isActive) {
        return res.status(400).json({
          success: false,
          message: "New reviewer must exist and be active",
        });
      }

      if (oldAssignment.reviewer.toString() === newReviewerId) {
        return res.status(400).json({
          success: false,
          message: "The proposal is already assigned to this exact reviewer.",
        });
      }

      // 3. Ensure the new reviewer hasn't previously rejected this exact proposal
      const previouslyRejected = await ReviewAssignment.findOne({
        proposal: oldAssignment.proposal,
        reviewer: newReviewerId,
        status: "rejected",
      }).lean();

      if (previouslyRejected) {
        return res.status(409).json({
          success: false,
          message:
            "This reviewer previously rejected this proposal. Please select a different reviewer.",
        });
      }

      // Mark the old assignment as withdrawn (preserving history)
      // If it was already "rejected", we don't need to withdraw it, but if it was "assigned", "accepted", or "in_progress", we do.
      if (oldAssignment.status !== "rejected") {
        oldAssignment.status = "withdrawn";
        // Optionally save a reason: oldAssignment.declineReason = "Admin forcibly reassigned";
        await oldAssignment.save();
      }

      // 5. Create the NEW assignment record
      const newAssignment = await ReviewAssignment.create({
        proposal: oldAssignment.proposal,
        reviewer: newReviewerId,
        status: "assigned",
        assignedBy: req.userId,
        assignedAt: new Date(),
        ...(dueAt ? { dueAt: new Date(dueAt) } : {}),
      });

      // 6. Update Proposal metadata
      const proposal = await Proposal.findById(oldAssignment.proposal);
      if (proposal) {
        const now = new Date();
        proposal.status = "Waiting to be assigned";
        proposal.assignedAt = now;
        proposal.lastStatusChangedBy = newReviewerId;
        proposal.lastStatusChangedAt = now;
        await proposal.save();
      }

      // 7. Send Notifications
      // Notify the new reviewer
      await NotificationController.createNotification({
        title: "New Proposal Assigned",
        message: `You have been assigned to review a proposal. Please check your dashboard for details.`,
        proposalId: oldAssignment.proposal,
        senderId: req.userId,
        receiverId: newReviewerId,
      });

      // Optionally notify the old reviewer that it was taken away from them
      if (oldAssignment.status === "withdrawn") {
        await NotificationController.createNotification({
          title: "Proposal Assignment Withdrawn",
          message: `The proposal you were assigned to review has been withdrawn and reassigned by the administrator.`,
          proposalId: oldAssignment.proposal,
          senderId: req.userId,
          receiverId: oldAssignment.reviewer,
        });
      }

      return res.status(200).json({
        success: true,
        message:
          "Assignment successfully withdrawn and reassigned to the new reviewer.",
        data: {
          withdrawnAssignment: oldAssignment._id,
          newAssignment,
        },
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
