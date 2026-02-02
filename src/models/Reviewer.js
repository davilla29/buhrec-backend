// models/Reviewer.js
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

    // matches UI: single name input
    fullName: { type: String, required: true, trim: true },

    institution: { type: String, required: true, trim: true },

    title: { type: String, required: true, trim: true }, // "Reviewer Title"
    specialization: { type: String, required: true, trim: true }, // dropdown value
    yearsOfExperience: { type: Number, required: true, min: 0 },

    // photo stored directly in MongoDB
    photo: {
      data: Buffer,
      contentType: String,
    },

    // ✅ cloudinary photo fields
    photoUrl: { type: String, default: "" },
    photoPublicId: { type: String, default: "" },

    role: { type: String, default: "reviewer", immutable: true },

    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

export const Reviewer = mongoose.model("Reviewer", reviewerSchema);
