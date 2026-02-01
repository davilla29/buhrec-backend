import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Researcher } from "../models/Researcher.js";
import { Reviewer } from "../models/Reviewer.js";
import { Administrator } from "../models/Administrator.js";


// small sanitize helper (don’t return password/photo buffer)
const sanitizeReviewer = (r) => ({
  _id: r._id,
  email: r.email,
  fullName: r.fullName,
  institution: r.institution,
  title: r.title,
  specialization: r.specialization,
  yearsOfExperience: r.yearsOfExperience,
  role: r.role,
  isActive: r.isActive,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  hasPhoto: Boolean(r.photo?.data),
});

async function emailExistsAnywhere(email) {
  return (
    (await Researcher.exists({ email })) ||
    (await Reviewer.exists({ email })) ||
    (await Administrator.exists({ email }))
  );
}

class AdminController {
  static async addReviewer(req, res) {
    try {
      const {
        fullName,
        email,
        institution,
        title,
        specialization,
        yearsOfExperience,
      } = req.body;

      // Basic validation (matching your UI)
      if (
        !fullName ||
        !email ||
        !institution ||
        !title ||
        !specialization ||
        yearsOfExperience === undefined
      ) {
        return res.status(400).json({
          success: false,
          message:
            "fullName, email, institution, title, specialization, yearsOfExperience are required",
        });
      }

      const yrs = Number(yearsOfExperience);
      if (Number.isNaN(yrs) || yrs < 0) {
        return res.status(400).json({
          success: false,
          message: "yearsOfExperience must be a valid number >= 0",
        });
      }

      const exists = await emailExistsAnywhere(email);
      if (exists) {
        return res
          .status(409)
          .json({ success: false, message: "Email already in use" });
      }

      // If a photo was uploaded, it will be in req.file (multer memory storage)
      const photo = req.file
        ? { data: req.file.buffer, contentType: req.file.mimetype }
        : undefined;

      // auto-generate password
      const password = crypto.randomBytes(8).toString("base64"); // 16-ish chars
      const hashedPassword = await bcrypt.hash(password, 12);

      const reviewer = await Reviewer.create({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        institution: institution.trim(),
        title: title.trim(),
        specialization: specialization.trim(),
        yearsOfExperience: yrs,
        password: hashedPassword,
        ...(photo ? { photo } : {}),
      });

      // TODO: send email with generated password (your existing mailer)
      // await sendReviewerWelcomeEmail(reviewer.email, password);

      return res.status(201).json({
        success: true,
        message: "Reviewer created successfully",
        data: sanitizeReviewer(reviewer),
        emailSent: false, // change to true if you actually send it above
      });
    } catch (error) {
      // Multer fileFilter errors often come as Error with message you set
      if (error?.message?.includes("Only JPG, PNG, or WEBP")) {
        return res.status(400).json({ success: false, message: error.message });
      }

      console.error("Add reviewer error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
}

export default AdminController;
