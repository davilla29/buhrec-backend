import mongoose from "mongoose";

const reviewAssignmentSchema = new mongoose.Schema(
  {
    proposal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
      required: true,
      index: true,
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reviewer",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["assigned", "accepted", "rejected", "in_progress", "submitted", "withdrawn"],
      default: "assigned",
      index: true,
    },

    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Administrator" },
    assignedAt: { type: Date, default: Date.now },

    dueAt: { type: Date },
  },
  { timestamps: true },
);

reviewAssignmentSchema.index({ proposal: 1, reviewer: 1 }, { unique: true });

export const ReviewAssignment = mongoose.model(
  "ReviewAssignment",
  reviewAssignmentSchema,
);
