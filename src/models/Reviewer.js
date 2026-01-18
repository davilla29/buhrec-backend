import mongoose from "mongoose";

const reviewerSchema = new mongoose.Schema(
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

    institution: { type: String, trim: true },
    department: { type: String, trim: true },

    expertise: [{ type: String, trim: true }], // e.g. "Public Health", "AI", "Clinical Trials"
    experience: { type: String, trim: true },

    role: { type: String, default: "reviewer", immutable: true },

    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

export const Reviewer = mongoose.model("Reviewer", reviewerSchema);
