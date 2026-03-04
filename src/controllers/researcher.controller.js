import mongoose from "mongoose";
import { Proposal } from "../models/Proposal.js";
import axios from "axios";
import { Researcher } from "../models/Researcher.js";
import { Administrator } from "../models/Administrator.js";
import { ProposalVersion } from "../models/ProposalVersion.js";
import { ReviewComment } from "../models/ReviewComment.js";
import { ReviewAssignment } from "../models/ReviewAssignment.js";
import { generateUniqueApplicationId } from "../utils/generateApplicationId.js";
import {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinaryUpload.js";
import NotificationController from "./notification.controller.js";

async function uploadFilesToStorage(
  filesObj = {},
  { proposalId, versionTag } = {},
) {
  const uploads = [];

  for (const [fieldname, fileArray] of Object.entries(filesObj)) {
    const f = fileArray[0]; // Extract the single file from the array

    const result = await uploadBufferToCloudinary(f.buffer, {
      folder: `buhrec/proposals/${proposalId}`,
      resource_type: "auto",
      public_id: `${Date.now()}-${f.originalname}`.replace(/\s+/g, "_"),
      tags: ["proposal", versionTag].filter(Boolean),
    });

    uploads.push({
      type: fieldname, // Map directly to "applicationLetter" or "proposalDocument"
      filename: f.originalname,
      url: result.secure_url,
      mimeType: f.mimetype,
      size: f.size,
      uploadedAt: new Date(),
      publicId: result.public_id,
    });
  }

  return uploads;
}

function validateDraftRequirements(draft) {
  if (!draft) return "Draft not found";

  const fd = draft.formData || {};

  if (!fd.projectName?.trim()) return "Project name is required";

  // Check that the array exists, is not empty, and the first item isn't blank
  if (
    !fd.researchers ||
    !Array.isArray(fd.researchers) ||
    fd.researchers.length === 0 ||
    !fd.researchers[0]?.trim()
  ) {
    return "At least one researcher name is required";
  }

  if (!fd.institution?.trim()) return "Institution is required";

  if (!fd.college?.trim()) return "College/School is required";

  if (!fd.department?.trim()) return "Department is required";

  if (!fd.category) return "Category is required";

  if (!fd.supervisor?.trim()) return "Supervisor is required";

  if (!fd.supervisorEmail?.trim()) return "Supervisor email is required";

  if (!draft.documents?.length)
    return "All required documents must be uploaded";

  const hasApplicationLetter = draft.documents.some(
    (d) => d.type === "applicationLetter",
  );

  const hasProposalDocument = draft.documents.some(
    (d) => d.type === "proposalDocument",
  );

  if (!hasApplicationLetter) return "Application letter is required";

  if (!hasProposalDocument) return "Proposal document is required";

  return null;
}

class ResearcherController {
  // ==========================================
  // RESEARCHER DASHBOARD STATS
  // ==========================================
  static async getDashboardStats(req, res) {
    try {
      const userId = req.userId;

      // Fetch all proposals for this researcher
      const proposals = await Proposal.find({ researcher: userId }).lean();

      // Define how we categorize statuses
      const finalStatuses = ["Approved", "Rejected"];
      const draftStatuses = ["Draft"];

      let completedCount = 0;
      let draftCount = 0;
      let ongoingProposals = [];

      // Categorize proposals
      proposals.forEach((p) => {
        if (finalStatuses.includes(p.status)) {
          completedCount++;
        } else if (draftStatuses.includes(p.status)) {
          draftCount++;
        } else {
          // Anything else (Paid, Waiting to be assigned, Under Review, etc.) is ongoing
          ongoingProposals.push(p);
        }
      });

      // Sort ongoing proposals to find the most recently updated one
      ongoingProposals.sort(
        (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
      );
      const activeProposal =
        ongoingProposals.length > 0 ? ongoingProposals[0] : null;

      let timeline = [];

      // Build the timeline array if there is an active proposal
      if (activeProposal) {
        // 1. Submission Event
        if (activeProposal.submittedAt) {
          timeline.push({
            label: "Your proposal has submitted", // Matches UI wording
            date: activeProposal.submittedAt,
            isCurrent: false,
          });
        }

        // 2. Assignment Event
        if (activeProposal.assignedAt) {
          timeline.push({
            label: "Your proposal has been assigned to a reviewer",
            date: activeProposal.assignedAt,
            isCurrent: false,
          });
        }

        // 3. Current Status Event
        let currentStatusLabel = `Proposal status: ${activeProposal.status}`;
        if (activeProposal.status === "Under Review") {
          currentStatusLabel = "Your proposal is under review";
        } else if (activeProposal.status === "Waiting to be assigned") {
          currentStatusLabel = "Your proposal is waiting for a reviewer";
        } else if (activeProposal.status === "Awaiting Modifications") {
          currentStatusLabel = "Modifications requested for your proposal";
        }

        // Push the most recent status (ensuring we don't duplicate timestamps exactly)
        timeline.push({
          label: currentStatusLabel,
          date: activeProposal.lastStatusChangedAt || activeProposal.updatedAt,
          isCurrent: true, // Frontend can use this to color the dot blue
        });

        // Sort the timeline descending (newest event at index 0, like your UI)
        timeline.sort((a, b) => new Date(b.date) - new Date(a.date));
      }

      return res.status(200).json({
        success: true,
        data: {
          stats: {
            completedProposals: completedCount,
            draftProposals: draftCount,
            ongoingProposalStatus: activeProposal
              ? activeProposal.status
              : "None",
          },
          ongoingProposal: activeProposal
            ? {
                _id: activeProposal._id,
                title: activeProposal.title,
                timeline: timeline,
              }
            : null, // If null, the frontend can show "You have no ongoing proposals" text
        },
      });
    } catch (error) {
      console.error("getDashboardStats error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

//  To get draft details for a specific proposal
  static async getDraft(req, res) {
    try {
      const { proposalId } = req.params;

      const proposal = await Proposal.findOne({
        _id: proposalId,
        researcher: req.userId,
      });

      if (!proposal) {
        return res
          .status(404)
          .json({ success: false, message: "Proposal not found" });
      }

      const draft = await ProposalVersion.findOne({
        proposal: proposal._id,
        versionNumber: 0,
      });

      if (!draft) {
        return res
          .status(404)
          .json({ success: false, message: "Draft not found" });
      }

      return res.status(200).json({ success: true, draft });
    } catch (err) {
      console.error("getDraft error:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  static async createProposal(req, res) {
    try {
      const { title } = req.body;
      const researcherId = req.userId;

      // Check if proposal already exists
      const existingProposal = await Proposal.findOne({
        researcher: researcherId,
      });

      if (existingProposal) {
        return res.status(400).json({
          success: false,
          message:
            "You have already created a proposal. You can update it instead.",
        });
      }

      if (!title) {
        return res
          .status(400)
          .json({ success: false, message: "Title is required" });
      }

      const applicationId = await generateUniqueApplicationId("BUH");

      const proposal = await Proposal.create({
        researcher: req.userId,
        title,
        applicationId,
        status: "Draft",
      });

      // IMMEDIATELY create the initial draft (v0)
      // and pre-fill the projectName so they match perfectly!
      const draft = await ProposalVersion.create({
        proposal: proposal._id,
        versionNumber: 0,
        kind: "draft",
        formData: {
          projectName: title,
          researchers: [],
        },
        createdBy: req.userId,
      });

      return res.status(201).json({ success: true, proposal, draft });
    } catch (err) {
      console.log("createProposal error:", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Save draft (version 0)
  static async saveDraft(req, res) {
    try {
      const { proposalId } = req.params;
      const { formData } = req.body;

      // 1. Find proposal WITHOUT .session(session)
      const proposal = await Proposal.findOne({
        _id: proposalId,
        researcher: req.userId,
      });

      if (!proposal) {
        return res
          .status(404)
          .json({ success: false, message: "Proposal not found" });
      }

      // 2. Lock check
      const lockedStatuses = ["Under Review", "Approved", "Rejected"];
      if (lockedStatuses.includes(proposal.status)) {
        return res.status(400).json({
          success: false,
          message: "Proposal is locked and cannot be edited",
        });
      }

      // 3. Find existing draft WITHOUT .session(session)
      const existingDraft = await ProposalVersion.findOne({
        proposal: proposal._id,
        versionNumber: 0,
      });

      // 4. Handle Documents (Delete replaced ones, append new ones)
      let mergedDocuments = existingDraft ? [...existingDraft.documents] : [];
      const incomingFiles = req.files || {};
      const newFileTypes = Object.keys(incomingFiles);

      for (const type of newFileTypes) {
        const existingDocIndex = mergedDocuments.findIndex(
          (d) => d.type === type,
        );

        if (existingDocIndex !== -1) {
          const oldDoc = mergedDocuments[existingDocIndex];
          try {
            await deleteFromCloudinary(oldDoc.publicId);
          } catch (deleteErr) {
            console.error(
              `Failed to delete old ${type} from Cloudinary:`,
              deleteErr,
            );
          }
          mergedDocuments.splice(existingDocIndex, 1);
        }
      }

      const uploaded = await uploadFilesToStorage(incomingFiles, {
        proposalId: proposal._id.toString(),
        versionTag: "draft",
      });

      mergedDocuments = [...mergedDocuments, ...uploaded];

      // 5. Merge formData for PATCH behavior
      const parsedFormData =
        typeof formData === "string" ? JSON.parse(formData) : formData || {};

      // Auto Sync ogic
      if (
        parsedFormData.projectName &&
        parsedFormData.projectName !== proposal.title
      ) {
        proposal.title = parsedFormData.projectName;
        await proposal.save(); // Save the updated shell title
      }
      const existingFormData = existingDraft?.formData
        ? existingDraft.formData.toObject()
        : {};

      const mergedFormData = {
        ...existingFormData,
        ...parsedFormData,
      };

      // 6. Update or create the draft WITHOUT session
      const draft = await ProposalVersion.findOneAndUpdate(
        { proposal: proposal._id, versionNumber: 0 },
        {
          proposal: proposal._id,
          versionNumber: 0,
          kind: "draft",
          formData: mergedFormData,
          documents: mergedDocuments,
          createdBy: req.userId,
        },
        { new: true, upsert: true },
      );

      return res.status(200).json({ success: true, draft });
    } catch (err) {
      console.log("saveDraft error:", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Initiate payment (7000 fixed) AFTER requirements are met
  static async initPayment(req, res) {
    try {
      const { proposalId } = req.params;

      const proposal = await Proposal.findOne({
        _id: proposalId,
        researcher: req.userId,
      });

      if (!proposal) {
        return res
          .status(404)
          .json({ success: false, message: "Proposal not found" });
      }

      if (proposal.payment?.status === "paid" || proposal.status === "Paid") {
        return res
          .status(400)
          .json({ success: false, message: "Already paid" });
      }

      const draft = await ProposalVersion.findOne({
        proposal: proposal._id,
        versionNumber: 0,
      });

      if (!draft) {
        return res
          .status(400)
          .json({ success: false, message: "Save a draft first" });
      }

      console.log(draft);

      const requirementError = validateDraftRequirements(draft);
      if (requirementError) {
        return res
          .status(400)
          .json({ success: false, message: requirementError });
      }

      // mark awaiting payment
      proposal.status = "Awaiting Payment";
      proposal.payment = proposal.payment || {};
      proposal.payment.status = "pending";
      proposal.payment.txRef = `TX-${proposal.applicationId}-${Date.now()}`;

      await proposal.save();

      const researcher = await Researcher.findById(req.userId).select(
        "email fullName",
      );

      if (!researcher) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      // Initialize payment directly via Flutterwave API
      const flutterwavePayload = {
        tx_ref: proposal.payment.txRef,
        amount: 7000,
        currency: "NGN",
        redirect_url: `${process.env.BACKEND_URL_DEV}/api/payments/flutterwave/callback`, // Make sure this is in your .env
        customer: {
          email: researcher.email,
          name: researcher.fullName,
        },
        customizations: {
          title: "BUHREC Proposal Submission",
          description: `Payment for proposal: ${proposal.title}`,
        },
        meta: {
          proposalId: proposal._id.toString(),
          applicationId: proposal.applicationId,
        },
      };

      const response = await axios.post(
        "https://api.flutterwave.com/v3/payments",
        flutterwavePayload,
        {
          headers: {
            Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        },
      );

      // Flutterwave returns the payment link in response.data.data.link
      const paymentLink = response.data.data.link;

      return res.status(200).json({
        success: true,
        amount: 7000,
        currency: "NGN",
        txRef: proposal.payment.txRef,
        paymentLink, // The frontend will use this to redirect the user
      });
    } catch (err) {
      // Axios errors are nested, so we log err.response.data to see what Flutterwave complained about
      console.log("initPayment error:", err?.response?.data || err.message);
      return res
        .status(500)
        .json({ success: false, message: "Failed to initialize payment" });
    }
  }

  // Submit initial version (v1) after payment success
  static async submitInitial(req, res) {
    try {
      const { proposalId } = req.params;

      const proposal = await Proposal.findOne({
        _id: proposalId,
        researcher: req.userId,
      });

      if (!proposal)
        return res
          .status(404)
          .json({ success: false, message: "Proposal not found" });

      if (proposal.versionCount > 0) {
        return res.status(400).json({
          success: false,
          message: "Already submitted. Use version update flow if requested.",
        });
      }

      if (proposal.payment?.status !== "paid" || proposal.status !== "Paid") {
        return res.status(400).json({
          success: false,
          message: "Payment required before submission",
        });
      }

      const draft = await ProposalVersion.findOne({
        proposal: proposal._id,
        versionNumber: 0,
      });

      if (!draft)
        return res
          .status(400)
          .json({ success: false, message: "Draft not found" });

      // create version 1 snapshot from draft
      const v1 = await ProposalVersion.create({
        proposal: proposal._id,
        versionNumber: 1,
        kind: "submitted",
        formData: draft.formData,
        documents: draft.documents,
        changeNote: "Initial submission",
        createdBy: req.userId,
        submittedAt: new Date(),
      });

      proposal.currentVersion = v1._id;
      proposal.versionCount = 1;
      proposal.submittedAt = new Date();
      proposal.status = "Waiting to be assigned";

      await proposal.save();

      // Notify all administrators
      const admins = await Administrator.find({}).select("_id fullName email");

      for (const admin of admins) {
        await NotificationController.createNotification({
          title: "New Proposal Submitted",
          message: `Researcher has submitted a proposal titled "${proposal.title}" and it is awaiting assignment.`,
          proposalId: proposal._id,
          senderId: req.userId,
          senderModel: "Researcher",
          receiverId: admin._id,
          receiverModel: "Administrator",
        });
      }

      return res.status(200).json({ success: true, proposal, version: v1 });
    } catch (err) {
      console.log("submitInitial error:", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Get all proposals for the authenticated researcher
  static async getAllProposals(req, res) {
    try {
      // Find all proposals matching the logged-in user's ID
      // Sorting by updatedAt descending ensures the most recently modified ones appear first
      const proposals = await Proposal.find({ researcher: req.userId })
        .sort({ updatedAt: -1 })
        .lean();

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

  // Get all versions for a particular proposal
  static async listVersions(req, res) {
    try {
      const { proposalId } = req.params;

      // Verify proposal belongs to the logged-in researcher
      const proposal = await Proposal.findOne({
        _id: proposalId,
        researcher: req.userId,
      });

      if (!proposal)
        return res
          .status(404)
          .json({ success: false, message: "Proposal not found" });

      // Fetch all submitted versions
      const versions = await ProposalVersion.find({
        proposal: proposal._id,
        kind: "submitted",
      })
        .sort({ versionNumber: -1 })
        .lean();

      // Count reviewer comments per version
      const counts = await ReviewComment.aggregate([
        { $match: { proposal: proposal._id, isVisibleToResearcher: true } },
        { $group: { _id: "$proposalVersion", count: { $sum: 1 } } },
      ]);

      // Attach comment counts to each version
      const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

      const enriched = versions.map((v) => ({
        ...v,
        commentCount: countMap.get(String(v._id)) || 0,
      }));

      return res.status(200).json({
        success: true,
        proposal: {
          _id: proposal._id,
          title: proposal.title,
          applicationId: proposal.applicationId,
          status: proposal.status,
          currentVersion: proposal.currentVersion,
          versionCount: proposal.versionCount,
        },
        versions: enriched,
      });
    } catch (err) {
      console.log("listVersions error:", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Get comments for each version
  static async getVersionComments(req, res) {
    try {
      const { proposalId, versionNumber } = req.params;

      const proposal = await Proposal.findOne({
        _id: proposalId,
        researcher: req.userId,
      });

      if (!proposal)
        return res
          .status(404)
          .json({ success: false, message: "Proposal not found" });

      const version = await ProposalVersion.findOne({
        proposal: proposal._id,
        versionNumber: Number(versionNumber),
        kind: "submitted",
      });

      if (!version)
        return res
          .status(404)
          .json({ success: false, message: "Version not found" });

      const comments = await ReviewComment.find({
        proposal: proposal._id,
        proposalVersion: version._id,
        isVisibleToResearcher: true,
      })
        .sort({ createdAt: -1 })
        .populate("reviewer", "fullName email") // adjust reviewer fields
        .lean();

      return res.status(200).json({ success: true, version, comments });
    } catch (err) {
      console.log("getVersionComments error:", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Submit v2+ when Awaiting Modifications
  // static async submitUpdatedVersion(req, res) {
  //   const session = await mongoose.startSession();
  //   session.startTransaction();

  //   try {
  //     const { proposalId } = req.params;
  //     const { formData, changeNote } = req.body;

  //     const proposal = await Proposal.findOne({
  //       _id: proposalId,
  //       researcher: req.userId,
  //     }).session(session);

  //     if (!proposal)
  //       return res
  //         .status(404)
  //         .json({ success: false, message: "Proposal not found" });

  //     if (proposal.status !== "Awaiting Modifications") {
  //       return res.status(400).json({
  //         success: false,
  //         message:
  //           "You can only submit updates when modifications are requested",
  //       });
  //     }

  //     if (!changeNote || changeNote.trim().length < 3) {
  //       return res.status(400).json({
  //         success: false,
  //         message: "changeNote is required (briefly explain what you changed)",
  //       });
  //     }

  //     //   const uploaded = await uploadFilesToStorage(req.files || []);
  //     const uploaded = await uploadFilesToStorage(req.files || [], {
  //       proposalId: proposal._id.toString(),
  //       versionTag: `v${proposal.versionCount + 1}`,
  //     });

  //     const parsedFormData =
  //       typeof formData === "string" ? JSON.parse(formData) : formData;

  //     const nextVersionNumber = proposal.versionCount + 1;

  //     const newV = await ProposalVersion.create(
  //       [
  //         {
  //           proposal: proposal._id,
  //           versionNumber: nextVersionNumber,
  //           kind: "submitted",
  //           formData: parsedFormData,
  //           documents: uploaded,
  //           changeNote,
  //           createdBy: req.userId,
  //           submittedAt: new Date(),
  //         },
  //       ],
  //       { session },
  //     );

  //     // ✅ Check if there is an "active" assignment for this proposal
  //     // Active means a reviewer is still responsible for it.
  //     const activeAssignment = await ReviewAssignment.findOne({
  //       proposal: proposal._id,
  //       status: { $in: ["assigned", "accepted", "in_progress"] },
  //     })
  //       .select("_id status reviewer")
  //       .session(session)
  //       .lean();

  //     // ✅ Update proposal pointers + status based
  //     proposal.currentVersion = newV[0]._id;
  //     proposal.versionCount = nextVersionNumber;

  //     proposal.status = activeAssignment
  //       ? "Under Review"
  //       : "Waiting to be assigned";

  //     await proposal.save({ session });

  //     await session.commitTransaction();
  //     session.endSession();

  //     // Notify assigned reviewer if proposal is still actively assigned
  //     if (activeAssignment) {
  //       await createNotification({
  //         title: "Updated Proposal Submitted",
  //         message: `The researcher has submitted an updated version of the proposal "${proposal.title}". Please review the changes.`,
  //         proposalId: proposal._id,
  //         senderId: req.userId,
  //         receiverId: activeAssignment.reviewer,
  //       });
  //     }

  //     return res.status(200).json({
  //       success: true,
  //       proposal,
  //       version: newV[0],
  //       hasActiveAssignment: Boolean(activeAssignment),
  //       assignmentStatus: activeAssignment?.status || null,
  //     });
  //   } catch (err) {
  //     await session.abortTransaction();
  //     session.endSession();
  //     console.log("submitUpdatedVersion error:", err);
  //     return res.status(500).json({ success: false, message: err.message });
  //   }
  // }

  static async submitUpdatedVersion(req, res) {
    try {
      const { proposalId } = req.params;
      const { formData, changeNote } = req.body;

      const proposal = await Proposal.findOne({
        _id: proposalId,
        researcher: req.userId,
      });

      if (!proposal)
        return res
          .status(404)
          .json({ success: false, message: "Proposal not found" });

      if (proposal.status !== "Awaiting Modifications") {
        return res.status(400).json({
          success: false,
          message:
            "You can only submit updates when modifications are requested",
        });
      }

      if (!changeNote || changeNote.trim().length < 3) {
        return res.status(400).json({
          success: false,
          message: "changeNote is required (briefly explain what you changed)",
        });
      }

      const previousVersion = await ProposalVersion.findOne({
        proposal: proposal._id,
        versionNumber: proposal.versionCount,
      });

      let mergedDocuments = previousVersion
        ? [...previousVersion.documents]
        : [];
      const incomingFiles = req.files || {};
      const newFileTypes = Object.keys(incomingFiles);

      for (const type of newFileTypes) {
        const existingDocIndex = mergedDocuments.findIndex(
          (d) => d.type === type,
        );
        if (existingDocIndex !== -1) {
          mergedDocuments.splice(existingDocIndex, 1);
        }
      }

      const uploaded = await uploadFilesToStorage(incomingFiles, {
        proposalId: proposal._id.toString(),
        versionTag: `v${proposal.versionCount + 1}`,
      });

      mergedDocuments = [...mergedDocuments, ...uploaded];

      const parsedFormData =
        typeof formData === "string" ? JSON.parse(formData) : formData;

      const nextVersionNumber = proposal.versionCount + 1;

      const newV = await ProposalVersion.create({
        proposal: proposal._id,
        versionNumber: nextVersionNumber,
        kind: "submitted",
        formData: parsedFormData,
        documents: mergedDocuments, // Use merged array
        changeNote,
        createdBy: req.userId,
        submittedAt: new Date(),
      });

      // Check if there is an "active" assignment for this proposal
      const activeAssignment = await ReviewAssignment.findOne({
        proposal: proposal._id,
        status: { $in: ["assigned", "accepted", "in_progress"] },
      })
        .select("_id status reviewer")
        .lean();

      // Update proposal pointers + status based
      proposal.currentVersion = newV._id;
      proposal.versionCount = nextVersionNumber;

      proposal.status = activeAssignment
        ? "Under Review"
        : "Waiting to be assigned";

      await proposal.save();

      // Notify assigned reviewer if proposal is still actively assigned
      if (activeAssignment) {
        await NotificationController.createNotification({
          title: "Updated Proposal Submitted",
          message: `The researcher has submitted an updated version of the proposal "${proposal.title}". Please review the changes.`,
          proposalId: proposal._id,
          senderId: req.userId,
          senderModel: "Researcher",
          receiverId: activeAssignment.reviewer,
          receiverModel: "Reviewer",
        });
      }

      return res.status(200).json({
        success: true,
        proposal,
        version: newV,
        hasActiveAssignment: Boolean(activeAssignment),
        assignmentStatus: activeAssignment?.status || null,
      });
    } catch (err) {
      console.log("submitUpdatedVersion error:", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // ==========================================
  // UPDATE RESEARCHER PROFILE
  // ==========================================
  static async updateProfile(req, res) {
    try {
      const { fullName, institution, occupation } = req.body;

      // Find the researcher
      const researcher = await Researcher.findById(req.userId);
      if (!researcher) {
        return res
          .status(404)
          .json({ success: false, message: "Researcher not found" });
      }

      // Update allowed fields if they are provided
      if (fullName) researcher.fullName = fullName.trim();
      if (institution) researcher.institution = institution.trim();
      if (occupation) researcher.occupation = occupation.trim();

      await researcher.save();

      // Sanitize before sending back
      const safeUser = researcher.toObject();
      delete safeUser.password;
      delete safeUser.verificationToken;
      delete safeUser.verificationTokenExpiresAt;

      return res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        data: safeUser,
      });
    } catch (error) {
      console.error("Update researcher profile error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  // ==========================================
  // UPDATE RESEARCHER PASSWORD
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
      const researcher = await Researcher.findById(req.userId).select(
        "+password",
      );
      if (!researcher) {
        return res
          .status(404)
          .json({ success: false, message: "Researcher not found" });
      }

      // Verify current password
      const isMatch = await bcrypt.compare(
        currentPassword,
        researcher.password,
      );
      if (!isMatch) {
        return res
          .status(401)
          .json({ success: false, message: "Incorrect current password" });
      }

      // Hash and save new password
      researcher.password = await bcrypt.hash(newPassword, 12);
      await researcher.save();

      return res.status(200).json({
        success: true,
        message: "Password updated successfully",
      });
    } catch (error) {
      console.error("Update researcher password error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
}

export default ResearcherController;
