// models/ProposalVersion.js
import mongoose from "mongoose";

const proposalVersionSchema = new mongoose.Schema(
  {
    proposal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
      required: true,
      index: true,
    },

    // 0 = draft (editable)
    // 1,2,3... = submitted versions
    versionNumber: { type: Number, required: true },

    kind: {
      type: String,
      enum: ["draft", "submitted"],
      default: "draft",
      index: true,
    },

    formData: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    documents: [
      {
        _id: false,
        filename: { type: String, required: true },
        url: { type: String, required: true },
        mimeType: { type: String },
        size: { type: Number },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    changeNote: { type: String, trim: true }, // for version 2+ typically

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Researcher",
      required: true,
    },

    // set for submitted versions
    submittedAt: { type: Date },
  },
  { timestamps: true },
);

// one draft per proposal (version 0) and one record per submitted version number
proposalVersionSchema.index(
  { proposal: 1, versionNumber: 1 },
  { unique: true },
);

export const ProposalVersion = mongoose.model(
  "ProposalVersion",
  proposalVersionSchema,
);
