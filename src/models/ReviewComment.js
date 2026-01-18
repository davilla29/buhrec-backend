import mongoose from "mongoose";

const reviewCommentSchema = new mongoose.Schema(
  {
    proposal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
      required: true,
      index: true,
    },

    // attach feedback to a specific version (important for “view versions”)
    proposalVersion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProposalVersion",
      required: true,
      index: true,
    },

    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reviewer",
      required: true,
      index: true,
    },

    // optional: structure feedback per section in your form
    section: { type: String, trim: true }, // e.g. "Methodology", "Consent", "Risk"
    comment: { type: String, required: true, trim: true },

    // reviewer can recommend an outcome
    recommendation: {
      type: String,
      enum: ["approve", "minor_changes", "major_changes", "reject", "none"],
      default: "none",
      index: true,
    },

    isVisibleToResearcher: { type: Boolean, default: true }, // FR-8 delivery control
  },
  { timestamps: true },
);

reviewCommentSchema.index({ proposal: 1, proposalVersion: 1, createdAt: -1 });

export const ReviewComment = mongoose.model(
  "ReviewComment",
  reviewCommentSchema,
);
