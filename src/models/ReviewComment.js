import mongoose from "mongoose";

const reviewCommentSchema = new mongoose.Schema(
  {
    proposal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
      required: true,
      index: true,
    },
    // Added assignment field to match your controller logic
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReviewAssignment",
      required: true,
      index: true,
    },
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
    comment: { type: String, required: true, trim: true },
    recommendation: {
      type: String,
      enum: ["approve", "minor_changes", "major_changes", "reject", "none"],
      default: "none",
      index: true,
    },
    isVisibleToResearcher: { type: Boolean, default: true },
  },
  { timestamps: true },
);

reviewCommentSchema.index({ assignment: 1, proposalVersion: 1, createdAt: -1 });

export const ReviewComment = mongoose.model(
  "ReviewComment",
  reviewCommentSchema,
);
