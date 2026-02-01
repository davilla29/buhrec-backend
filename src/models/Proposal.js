// models/Proposal.js
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

    // Application ID like: BUH-AF9SK2
    applicationId: { type: String, required: true, unique: true, index: true },

    status: {
      type: String,
      enum: [
        "Draft",
        "Awaiting Payment",
        "Paid", // <-- added (ready-to-submit)
        "Under Review",
        "Awaiting Modifications",
        "Rejected",
        "Approved",
      ],
      default: "Draft",
      index: true,
    },

    // fixed fee
    feeAmount: { type: Number, default: 7000, immutable: true },
    currency: { type: String, default: "NGN", immutable: true },

    payment: {
      status: {
        type: String,
        enum: ["unpaid", "pending", "paid", "failed"],
        default: "unpaid",
        index: true,
      },
      txRef: { type: String, index: true }, // your unique reference
      flutterwaveTransactionId: { type: String },
      paidAt: { type: Date },
      raw: { type: mongoose.Schema.Types.Mixed }, // store verification response (optional)
    },

    // set when first submitted
    submittedAt: { type: Date },
    assignedAt: { type: Date },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },

    currentVersion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProposalVersion",
    },

    versionCount: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },

    // Once the reviewer accepts the assignment, the status is changed to under review and lastStatusChangedBy is set to teh reviewer's id
    lastStatusChangedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reviewer",
    },
    lastStatusChangedAt: { type: Date },
  },
  { timestamps: true },
);

proposalSchema.index({ researcher: 1, createdAt: -1 });

export const Proposal = mongoose.model("Proposal", proposalSchema);
