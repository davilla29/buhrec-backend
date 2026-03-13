// models/Researcher.js
import mongoose from "mongoose";

const researcherSchema = new mongoose.Schema(
  {
    // Matches UI (single "Name" field)
    fullName: { type: String, required: true, trim: true },

    // Matches UI ("Date of Birth")
    dateOfBirth: { type: Date, required: true },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    password: { type: String, required: true, select: false },

    institution: { type: String, required: true, trim: true },
    occupation: { type: String, required: true, trim: true },

    // Email verification
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String, select: false }, // hashed code
    verificationTokenExpiresAt: { type: Date, select: false },

    role: { type: String, default: "researcher", immutable: true },
    department: {
      type: String,
      default: "General",
    },

    phoneNumber: {
      type: String,
      default: "",
    },
    photoUrl: { type: String, default: "" },
    photoPublicId: { type: String, default: "" },

    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

export const Researcher = mongoose.model("Researcher", researcherSchema);
