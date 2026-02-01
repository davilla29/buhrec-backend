// middlewares/upload.js
import multer from "multer";

const storage = multer.memoryStorage();

// Optional: restrict file types
const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error("Only JPG, PNG, or WEBP images are allowed"), false);
  }
  cb(null, true);
};

export const uploadReviewerPhoto = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit (adjust if you want)
}).single("photo"); // <-- form field name must be "photo"
