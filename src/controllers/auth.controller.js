import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { Researcher } from "../models/Researcher.js";
import { Reviewer } from "../models/Reviewer.js";
import { Administrator } from "../models/Administrator.js";
import { generateTokenAndSetCookie } from "../utils/generateTokenAndSetCookie.js";

const DUMMY_PASSWORD_HASH =
  "$2a$10$CwTycUXWue0Thq9StjUM0uJ8axFzjcxgXmjKPqExE7hFl/jfD2N.G";

const isProduction = process.env.NODE_ENV === "production";

const ROLE_MODEL_MAP = {
  researcher: Researcher,
  reviewer: Reviewer,
  admin: Administrator,
};

function sanitize(docOrObj) {
  if (!docOrObj) return null;
  const obj = docOrObj?.toObject ? docOrObj.toObject() : docOrObj;
  delete obj.password;
  delete obj.verificationToken;
  delete obj.verificationTokenExpiresAt;
  return obj;
}

function generateVerificationCode() {
  // 6-digit numeric OTP
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function emailExistsAnywhere(email) {
  return (
    (await Researcher.exists({ email })) ||
    (await Reviewer.exists({ email })) ||
    (await Administrator.exists({ email }))
  );
}

async function findUserByEmailWithPassword(email) {
  const r = await Researcher.findOne({ email })
    .select("+password +verificationToken +verificationTokenExpiresAt")
    .lean();
  if (r) return r;

  const v = await Reviewer.findOne({ email })
    .select("+password +verificationToken +verificationTokenExpiresAt")
    .lean();
  if (v) return v;

  const a = await Administrator.findOne({ email })
    .select("+password +verificationToken +verificationTokenExpiresAt")
    .lean();
  if (a) return a;

  return null;
}

async function findUserByEmailForVerification(email) {
  // Only users whose token is not expired
  const r = await Researcher.findOne({
    email,
    verificationTokenExpiresAt: { $gt: new Date() },
  }).select("+verificationToken +verificationTokenExpiresAt");
  if (r) return { user: r, role: "researcher" };

  const v = await Reviewer.findOne({
    email,
    verificationTokenExpiresAt: { $gt: new Date() },
  }).select("+verificationToken +verificationTokenExpiresAt");
  if (v) return { user: v, role: "reviewer" };

  const a = await Administrator.findOne({
    email,
    verificationTokenExpiresAt: { $gt: new Date() },
  }).select("+verificationToken +verificationTokenExpiresAt");
  if (a) return { user: a, role: "admin" };

  return { user: null, role: null };
}

class AuthController {
  // Login
  static async login(req, res) {
    try {
      // Get inputs from the body

      const email = req.body?.email?.trim()?.toLowerCase();
      const { password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Email and password are required",
        });
      }

      const user = await findUserByEmailWithPassword(email);

      // Dummy compare if not found (prevents user-enumeration timing leak)
      if (!user) {
        await bcrypt.compare(password || "", DUMMY_PASSWORD_HASH);
        return res
          .status(400)
          .json({ success: false, message: "Invalid email or password" });
      }

      const ok = await bcrypt.compare(password, user.password);
      if (!ok) {
        return res
          .status(401)
          .json({ success: false, message: "Invalid credentials" });
      }

      // ✅ Email verified check
      if (user.isVerified === false) {
        const verificationCode = generateVerificationCode();
        const hashedCode = await bcrypt.hash(verificationCode, 10);

        const Model = ROLE_MODEL_MAP[user.role];
        await Model.updateOne(
          { _id: user._id },
          {
            $set: {
              verificationToken: hashedCode,
              verificationTokenExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
            },
          },
        );

        // TODO: send code
        // const displayName = user.fullName || `${user.fName ?? ""} ${user.lName ?? ""}`.trim();
        // await sendVerificationEmail(user.email, displayName, verificationCode);

        return res.status(403).json({
          success: false,
          message:
            "Email not verified. Check your inbox/spam for the verification code.",
          needVerification: true,
        });
      }

      generateTokenAndSetCookie(res, user._id, user.role);

      // Update lastLoginAt (best-effort)
      try {
        const Model = ROLE_MODEL_MAP[user.role];
        await Model.updateOne(
          { _id: user._id },
          { $set: { lastLoginAt: new Date() } },
        );
      } catch (_) {}

      // create a copy of the user object and remove the password from the copy.
      const safeUser = { ...user };
      delete safeUser.password;
      delete safeUser.verificationToken;
      delete safeUser.verificationTokenExpiresAt;

      return res.status(200).json({
        success: true,
        message: "Login successful",
        data: safeUser,
      });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  // Researcher Register
  static async researcherRegister(req, res) {
    try {
      const {
        fullName,
        email,
        dateOfBirth, // should be ISO string from frontend
        institution,
        occupation,
        password,
      } = req.body;

      if (
        !fullName ||
        !email ||
        !dateOfBirth ||
        !institution ||
        !occupation ||
        !password
      ) {
        return res.status(400).json({
          success: false,
          message:
            "fullName, email, dateOfBirth, institution, occupation, password are required",
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      const exists = await emailExistsAnywhere(normalizedEmail);
      if (exists) {
        return res
          .status(409)
          .json({ success: false, message: "Email already in use" });
      }

      const dob = new Date(dateOfBirth);
      if (Number.isNaN(dob.getTime())) {
        return res.status(400).json({
          success: false,
          message: "dateOfBirth must be a valid date",
        });
      }

      const hashed = await bcrypt.hash(password, 12);

      // generate OTP for verification
      const verificationCode = generateVerificationCode();
      const hashedCode = await bcrypt.hash(verificationCode, 10);

      const researcher = await Researcher.create({
        fullName: fullName.trim(),
        email: normalizedEmail,
        dateOfBirth: dob,
        institution: institution.trim(),
        occupation: occupation.trim(),
        password: hashedPassword,

        isVerified: false,
        verificationToken: hashedCode,
        verificationTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins
      });

      // TODO: send verification code email
      // await sendVerificationEmail(researcher.email, researcher.fullName, verificationCode);

      return res.status(201).json({
        success: true,
        message:
          "Account created. Please verify your email using the code sent to you.",
        data: sanitize(researcher),
        needVerification: true,
      });
    } catch (error) {
      console.error("Register error:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  }

  // Check auth
  static async checkAuth(req, res) {
    return res.status(200).json({
      success: true,
      data: req.user,
    });
  }

  //  Logout
  static logout(req, res) {
    res.clearCookie("token", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
    });

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  }
}

export default AuthController;
