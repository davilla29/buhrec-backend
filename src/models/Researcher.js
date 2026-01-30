import mongoose from "mongoose";

const researcherSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    fName: { type: String, required: true, trim: true },
    lName: { type: String, required: true, trim: true },
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
    department: { type: String, trim: true },
    phone: { type: String, trim: true },

    experience: { type: String, trim: true },
    role: { type: String, default: "researcher", immutable: true },

    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

export const Researcher = mongoose.model("Researcher", researcherSchema);
