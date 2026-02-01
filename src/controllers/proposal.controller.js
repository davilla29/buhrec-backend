import mongoose from "mongoose";
import crypto from "crypto";
import bcrypt from "bcryptjs";
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

class ProposalController {
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
}

export default ProposalController;
