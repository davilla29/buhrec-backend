import mongoose from "mongoose";

const researcherSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true, select: false }, // store hashed password
    fName: { type: String, required: true, trim: true },
    lName: { type: String, required: true, trim: true },

    institution: { type: String, required: true, trim: true }, // FR-1
    department: { type: String, trim: true }, // FR-2
    phone: { type: String, trim: true }, // FR-2

    experience: { type: String, trim: true },
    role: { type: String, default: "researcher", immutable: true },

    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

export const Researcher = mongoose.model("Researcher", researcherSchema);
