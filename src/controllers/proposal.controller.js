import mongoose from "mongoose";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Proposal } from "../models/Proposal.js";
import { ProposalVersion } from "../models/ProposalVersion.js";
import { ReviewComment } from "../models/ReviewComment.js";
import {generateUniqueApplicationId} from "../utils/generateApplicationId.js"
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";

async function uploadFilesToStorage(files = [], { proposalId, versionTag } = {}) {
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

class ProposalController {}

export default ProposalController;
