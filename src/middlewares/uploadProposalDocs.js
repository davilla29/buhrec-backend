// middlewares/uploadProposalDocs.js
import multer from "multer";

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
    "image/webp",
  ];
  if (!allowed.includes(file.mimetype)) {
    return cb(
      new Error("Only PDF, DOC/DOCX, JPG, PNG, or WEBP allowed"),
      false,
    );
  }
  cb(null, true);
};

export const uploadProposalDocs = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
}).fields([
  { name: "applicationLetter", maxCount: 1 },
  { name: "proposalDocument", maxCount: 1 },
  { name: "turnItInReport", maxCount: 1 },
]);
