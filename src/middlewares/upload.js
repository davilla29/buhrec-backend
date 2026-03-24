import multer from "multer";

const storage = multer.memoryStorage();

// Restrict file types
const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error("Only JPG, PNG, or WEBP images are allowed"), false);
  }
  cb(null, true);
};

// Base multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
});

// 1. Used by ADMIN when creating a new reviewer
export const uploadReviewerPhoto = upload.single("photo");

// 2. NEW: Used by REVIEWERS & RESEARCHERS when updating their own profile
export const updateProfilePhoto = (req, res, next) => {
  const singleUpload = upload.single("photo");

  singleUpload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      // Catch Multer-specific errors (e.g., "File too large", "Unexpected field")
      console.error("❌ MULTER ERROR:", err.message);
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}.`,
      });
    } else if (err) {
      // Catch custom errors from our fileFilter (e.g., wrong file type)
      console.error("❌ FILE ERROR:", err.message);
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    // If no error occurred, proceed to the controller
    next();
  });
};
