// import mongoose from "mongoose";

// const notificationSchema = new mongoose.Schema(
//   {
//     title: {
//       type: String,
//       required: true,
//     },
//     message: {
//       type: String,
//       required: true,
//     },
//     proposalId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Proposal",
//     },
//     sender: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//     },
//     receiver: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//     },
//     role: {
//       type: String,
//       enum: ["admin", "reviewer", "researcher"],
//     },
//     isRead: {
//       type: Boolean,
//       default: false,
//     },
//   },
//   { timestamps: true },
// );

// export const Notification = mongoose.model("Notification", notificationSchema);

import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
    },

    // ✅ Dynamic sender reference
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "senderModel",
    },
    senderModel: {
      type: String,
      required: true,
      enum: ["Researcher", "Reviewer", "Administrator"],
    },

    // ✅ Dynamic receiver reference
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "receiverModel",
    },
    receiverModel: {
      type: String,
      required: true,
      enum: ["Researcher", "Reviewer", "Administrator"],
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true },
);

// Useful index for fetching user notifications fast
notificationSchema.index({ receiver: 1, createdAt: -1 });

export const Notification = mongoose.model("Notification", notificationSchema);