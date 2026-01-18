import mongoose from "mongoose";

const proposalVersionSchema = new mongoose.Schema(
  {
    proposal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
      required: true,
      index: true,
    },

    versionNumber: { type: Number, required: true }, // 1,2,3...

    // snapshot of the structured form (project details etc.)
    formData: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    // supporting documents (FR-4)
    documents: [
      {
        _id: false,
        filename: { type: String, required: true },
        url: { type: String, required: true }, // or path if local
        mimeType: { type: String },
        size: { type: Number },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    // why this version exists (e.g., "Initial submission", "Addressed reviewer comment")
    changeNote: { type: String, trim: true },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Researcher",
      required: true,
    },
  },
  { timestamps: true },
);

// Ensure unique version per proposal
proposalVersionSchema.index(
  { proposal: 1, versionNumber: 1 },
  { unique: true },
);

export const ProposalVersion = mongoose.model(
  "ProposalVersion",
  proposalVersionSchema,
);
