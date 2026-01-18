import mongoose from "mongoose";

const administratorSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true, select: false },
    fName: { type: String, required: true, trim: true },
    lName: { type: String, required: true, trim: true },

    role: { type: String, default: "administrator", immutable: true },

    permissions: {
      type: [String],
      default: [
        "MANAGE_USERS",
        "ASSIGN_REVIEWERS",
        "UPDATE_PROPOSAL_STATUS",
        "VIEW_ALL_PROPOSALS",
        "MANAGE_PAYMENTS",
      ],
    },

    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

export const Administrator = mongoose.model(
  "Administrator",
  administratorSchema,
);
