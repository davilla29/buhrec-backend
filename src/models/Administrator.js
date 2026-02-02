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
    fullName: { type: String, required: true, trim: true },

    role: { type: String, default: "admin", immutable: true },

    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

export const Administrator = mongoose.model(
  "Administrator",
  administratorSchema,
);
