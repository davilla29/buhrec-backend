import { publicDecrypt } from "crypto";
import mongoose from "mongoose";

const formDataSchema = new mongoose.Schema(
  {
    projectName: { type: String, trim: true },
    researchers: [{ type: String, trim: true }],
    institution: { type: String, trim: true },
    college: { type: String, trim: true },
    department: { type: String, trim: true },

    category: {
      type: String,
      enum: ["UG", "PG", "Independent/Masters", "PhD", "International"],
    },

    supervisor: { type: String, trim: true },
    supervisorEmail: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
    },
  },
  { _id: false },
);

const documentSchema = new mongoose.Schema(
  {
    _id: false,
    type: {
      type: String,
      enum: ["applicationLetter", "proposalDocument"],
      required: true,
    },
    filename: { type: String, required: true },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    mimeType: { type: String },
    size: { type: Number },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const proposalVersionSchema = new mongoose.Schema(
  {
    proposal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
      required: true,
      index: true,
    },

    versionNumber: { type: Number, required: true },

    kind: {
      type: String,
      enum: ["draft", "submitted"],
      default: "draft",
      index: true,
    },

    formData: formDataSchema,

    documents: [documentSchema],

    changeNote: { type: String, trim: true },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Researcher",
      required: true,
    },

    submittedAt: { type: Date },
  },
  { timestamps: true },
);

proposalVersionSchema.index(
  { proposal: 1, versionNumber: 1 },
  { unique: true },
);

export const ProposalVersion = mongoose.model(
  "ProposalVersion",
  proposalVersionSchema,
);
