import mongoose from "mongoose";

const proposalSchema = new mongoose.Schema(
  {
    researcher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Researcher",
      required: true,
      index: true,
    },

    title: { type: String, required: true, trim: true },

    status: {
      type: String,
      enum: [
        "Draft",
        "Awaiting Payment",
        "Under Review",
        "Awaiting Modifications",
        "Rejected",
        "Approved",
      ],
      default: "Draft",
      index: true,
    },

    // set when first submitted
    submittedAt: { type: Date },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },

    // points to the latest version
    currentVersion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProposalVersion",
    },

    // simple counters for quick listing
    versionCount: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },

    // optional: admin who last changed status
    lastStatusChangedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Administrator",
    },
    lastStatusChangedAt: { type: Date },
  },
  { timestamps: true },
);

proposalSchema.index({ researcher: 1, createdAt: -1 });

export const Proposal = mongoose.model("Proposal", proposalSchema);
