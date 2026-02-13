import mongoose from "mongoose";
import { Proposal } from "../models/Proposal.js";
import { ProposalVersion } from "../models/ProposalVersion.js";
import { ReviewComment } from "../models/ReviewComment.js";
import { generateUniqueApplicationId } from "../utils/generateApplicationId.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";

async function uploadFilesToStorage(
  files = [],
  { proposalId, versionTag } = {},
) {
  if (!files.length) return [];

  const uploads = await Promise.all(
    files.map(async (f) => {
      // Cloudinary decides resource type automatically if you pass "auto"
      // This is important for PDF/DOCX etc.
      const result = await uploadBufferToCloudinary(f.buffer, {
        folder: `buhrec/proposals/${proposalId}`,
        resource_type: "auto",
        public_id: `${Date.now()}-${f.originalname}`.replace(/\s+/g, "_"),
        tags: ["proposal", versionTag].filter(Boolean),
      });

      return {
        filename: f.originalname,
        url: result.secure_url,
        mimeType: f.mimetype,
        size: f.size,
        uploadedAt: new Date(),
        // Optional extras:
        // publicId: result.public_id,
      };
    }),
  );

  return uploads;
}

function validateDraftRequirements(draft) {
  // Put your required fields here based on the UI
  // Example:
  const fd = draft?.formData || {};
  if (!fd.projectName && !fd.title) return "Project name/title is required";
  if (!fd.institution) return "Institution is required";
  if (!draft?.documents?.length) return "Supporting documents are required";
  return null;
}

class ResearcherController {
  static async createProposal(req, res) {
    try {
      const { title } = req.body;
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

      return res.status(201).json({ success: true, proposal });
    } catch (err) {
      console.log("createProposal error:", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Save draft (version 0)
  static async saveDraft(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { proposalId } = req.params;
      const { formData } = req.body; // formData should be JSON from frontend

      const proposal = await Proposal.findOne({
        _id: proposalId,
        researcher: req.userId,
      }).session(session);

      if (!proposal)
        return res
          .status(404)
          .json({ success: false, message: "Proposal not found" });

      // lock editing when truly locked
      const lockedStatuses = ["Under Review", "Approved", "Rejected"];
      if (lockedStatuses.includes(proposal.status)) {
        return res.status(400).json({
          success: false,
          message: "Proposal is locked and cannot be edited",
        });
      }
      const uploaded = await uploadFilesToStorage(req.files || [], {
        proposalId: proposal._id.toString(),
        versionTag: "draft",
      });

      const parsedFormData =
        typeof formData === "string" ? JSON.parse(formData) : formData;

      const existingDraft = await ProposalVersion.findOne({
        proposal: proposal._id,
        versionNumber: 0,
      }).session(session);

      const mergedDocuments =
        uploaded.length > 0 ? uploaded : existingDraft?.documents || [];

      const draft = await ProposalVersion.findOneAndUpdate(
        { proposal: proposal._id, versionNumber: 0 },
        {
          proposal: proposal._id,
          versionNumber: 0,
          kind: "draft",
          formData: parsedFormData,
          documents: mergedDocuments,

          createdBy: req.userId,
        },
        { new: true, upsert: true, session },
      );

      // Once draft is meaningful, you can set Awaiting Payment (optional)
      // proposal.status = "Awaiting Payment";
      await proposal.save({ session });

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({ success: true, draft });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
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

      if (!proposal)
        return res
          .status(404)
          .json({ success: false, message: "Proposal not found" });

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

      const requirementError = validateDraftRequirements(draft);
      if (requirementError) {
        return res
          .status(400)
          .json({ success: false, message: requirementError });
      }

      // mark awaiting payment
      proposal.status = "Awaiting Payment";
      proposal.payment.status = "pending";

      // txRef you can track back to proposal reliably
      proposal.payment.txRef = `TX-${proposal.applicationId}-${Date.now()}`;

      await proposal.save();

      // Call Flutterwave initialize payment
      // Return payment link to frontend (it opens it)
      // You will implement flutterwave service using your secret key
      const paymentLink = await req.flutterwave.init({
        amount: 7000,
        currency: "NGN",
        tx_ref: proposal.payment.txRef,
        customer: { email: req.user.email, name: req.user.fullName },
        meta: {
          proposalId: proposal._id.toString(),
          applicationId: proposal.applicationId,
        },
        redirect_url: `${process.env.API_BASE_URL}/api/payments/flutterwave/callback`,
      });

      return res.status(200).json({
        success: true,
        amount: 7000,
        currency: "NGN",
        txRef: proposal.payment.txRef,
        paymentLink,
      });
    } catch (err) {
      console.log("initPayment error:", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Submit initial version (v1) after payment success
  static async submitInitial(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { proposalId } = req.params;

      const proposal = await Proposal.findOne({
        _id: proposalId,
        researcher: req.userId,
      }).session(session);

      if (!proposal)
        return res
          .status(404)
          .json({ success: false, message: "Proposal not found" });

      if (proposal.payment?.status !== "paid" || proposal.status !== "Paid") {
        return res.status(400).json({
          success: false,
          message: "Payment required before submission",
        });
      }

      if (proposal.versionCount > 0) {
        return res.status(400).json({
          success: false,
          message: "Already submitted. Use version update flow if requested.",
        });
      }

      const draft = await ProposalVersion.findOne({
        proposal: proposal._id,
        versionNumber: 0,
      }).session(session);

      if (!draft)
        return res
          .status(400)
          .json({ success: false, message: "Draft not found" });

      // create version 1 snapshot from draft
      const v1 = await ProposalVersion.create(
        [
          {
            proposal: proposal._id,
            versionNumber: 1,
            kind: "submitted",
            formData: draft.formData,
            documents: draft.documents,
            changeNote: "Initial submission",
            createdBy: req.userId,
            submittedAt: new Date(),
          },
        ],
        { session },
      );

      proposal.currentVersion = v1[0]._id;
      proposal.versionCount = 1;
      proposal.submittedAt = new Date();
      proposal.status = "Waiting to be assigned";

      await proposal.save({ session });

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({ success: true, proposal, version: v1[0] });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      console.log("submitInitial error:", err);
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
  static async submitUpdatedVersion(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { proposalId } = req.params;
      const { formData, changeNote } = req.body;

      const proposal = await Proposal.findOne({
        _id: proposalId,
        researcher: req.userId,
      }).session(session);

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

      //   const uploaded = await uploadFilesToStorage(req.files || []);
      const uploaded = await uploadFilesToStorage(req.files || [], {
        proposalId: proposal._id.toString(),
        versionTag: `v${proposal.versionCount + 1}`,
      });

      const parsedFormData =
        typeof formData === "string" ? JSON.parse(formData) : formData;

      const nextVersionNumber = proposal.versionCount + 1;

      const newV = await ProposalVersion.create(
        [
          {
            proposal: proposal._id,
            versionNumber: nextVersionNumber,
            kind: "submitted",
            formData: parsedFormData,
            documents: uploaded,
            changeNote,
            createdBy: req.userId,
            submittedAt: new Date(),
          },
        ],
        { session },
      );

      proposal.currentVersion = newV[0]._id;
      proposal.versionCount = nextVersionNumber;
      proposal.status = "Under Review";
      await proposal.save({ session });

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        success: true,
        proposal,
        version: newV[0],
      });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      console.log("submitUpdatedVersion error:", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
}

export default ResearcherController;
