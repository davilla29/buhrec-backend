import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    researcher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Researcher",
      required: true,
    },
    proposal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },

    transactionId: {
      type: String,
    },
    txRef: { type: String, unique: true },
    paymentStatus: {
      type: String,
      enum: ["pending", "successful", "failed", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true },
);

export default mongoose.model("Payment", paymentSchema);
