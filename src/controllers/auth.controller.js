import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Researcher } from "../models/Researcher.js";
import { Reviewer } from "../models/Reviewer.js";
import { Administrator } from "../models/Administrator.js";
import { generateTokenAndSetCookie } from "../utils/generateTokenAndSetCookie.js";
import { sendVerificationCodeEmail } from "../mail/emailService.js";

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
  /* ==========================================
   RESEARCHER LOGIN
  ========================================== */
  static async researcherLogin(req, res) {
    try {
      const email = req.body?.email?.trim()?.toLowerCase();
      const { password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Email and password are required",
        });
      }

      const user = await Researcher.findOne({ email })
        .select("+password +verificationToken +verificationTokenExpiresAt")
        .lean();

      if (!user) {
        await bcrypt.compare(password || "", DUMMY_PASSWORD_HASH);
        return res
          .status(400)
          .json({ success: false, message: "Invalid credentials" });
      }

      const ok = await bcrypt.compare(password, user.password);
      if (!ok) {
        return res
          .status(401)
          .json({ success: false, message: "Invalid credentials" });
      }

      // Email verification check
      if (user.isVerified === false) {
        const verificationCode = generateVerificationCode();
        const hashedCode = await bcrypt.hash(verificationCode, 10);

        await Researcher.updateOne(
          { _id: user._id },
          {
            $set: {
              verificationToken: hashedCode,
              verificationTokenExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
            },
          },
        );

        try {
          const frontendUrl =
            process.env.NODE_ENV === "development"
              ? process.env.FRONTEND_URL_DEV
              : process.env.FRONTEND_URL_PROD;

          const verificationLink = `${frontendUrl}/verify-email`;
          const fullName =
            user.fullName || `${user.fName ?? ""} ${user.lName ?? ""}`.trim();

          await sendVerificationCodeEmail({
            fullName,
            userEmail: user.email,
            verificationCode,
            verificationLink,
          });
        } catch (mailErr) {
          console.error("Failed to send verification email:", mailErr);
        }

        return res.status(403).json({
          success: false,
          message:
            "Email not verified. Check your inbox/spam for the verification code.",
          needVerification: true,
        });
      }

     const token = generateTokenAndSetCookie(res, user._id, "researcher");

      // Update lastLoginAt
      try {
        await Researcher.updateOne(
          { _id: user._id },
          { $set: { lastLoginAt: new Date() } },
        );
      } catch (_) {}

      const safeUser = { ...user };
      delete safeUser.password;
      delete safeUser.verificationToken;
      delete safeUser.verificationTokenExpiresAt;

      return res.status(200).json({
        success: true,
        message: "Login successful",
        token,
        data: safeUser,
      });
    } catch (error) {
      console.error("Researcher login error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  /* ==========================================
   REVIEWER LOGIN
  ========================================== */
  static async reviewerLogin(req, res) {
    try {
      const email = req.body?.email?.trim()?.toLowerCase();
      const { password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Email and password are required",
        });
      }

      const user = await Reviewer.findOne({ email })
        .select("+password +verificationToken +verificationTokenExpiresAt")
        .lean();

      if (!user) {
        await bcrypt.compare(password || "", DUMMY_PASSWORD_HASH);
        return res
          .status(400)
          .json({ success: false, message: "Invalid credentials" });
      }

      const ok = await bcrypt.compare(password, user.password);
      if (!ok) {
        return res
          .status(401)
          .json({ success: false, message: "Invalid credentials" });
      }

      if (user.isVerified === false) {
        const verificationCode = generateVerificationCode();
        const hashedCode = await bcrypt.hash(verificationCode, 10);

        await Reviewer.updateOne(
          { _id: user._id },
          {
            $set: {
              verificationToken: hashedCode,
              verificationTokenExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
            },
          },
        );

        try {
          const frontendUrl =
            process.env.NODE_ENV === "development"
              ? process.env.FRONTEND_URL_DEV
              : process.env.FRONTEND_URL_PROD;

          const verificationLink = `${frontendUrl}/verify-email`;
          const fullName =
            user.fullName || `${user.fName ?? ""} ${user.lName ?? ""}`.trim();

          await sendVerificationCodeEmail({
            fullName,
            userEmail: user.email,
            verificationCode,
            verificationLink,
          });
        } catch (mailErr) {
          console.error("Failed to send verification email:", mailErr);
        }

        return res.status(403).json({
          success: false,
          message:
            "Email not verified. Check your inbox/spam for the verification code.",
          needVerification: true,
        });
      }

      const token = generateTokenAndSetCookie(res, user._id, "reviewer");

      try {
        await Reviewer.updateOne(
          { _id: user._id },
          { $set: { lastLoginAt: new Date() } },
        );
      } catch (_) {}

      const safeUser = { ...user };
      delete safeUser.password;
      delete safeUser.verificationToken;
      delete safeUser.verificationTokenExpiresAt;

      return res.status(200).json({
        success: true,
        message: "Login successful",
        token,
        data: safeUser,
      });
    } catch (error) {
      console.error("Reviewer login error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  /*==========================================
    ADMIN LOGIN
   ========================================== */
  static async adminLogin(req, res) {
    try {
      const email = req.body?.email?.trim()?.toLowerCase();
      const { password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Email and password are required",
        });
      }

      const user = await Administrator.findOne({ email })
        .select("+password +verificationToken +verificationTokenExpiresAt")
        .lean();

      if (!user) {
        await bcrypt.compare(password || "", DUMMY_PASSWORD_HASH);
        return res
          .status(400)
          .json({ success: false, message: "Invalid credentials" });
      }

      const ok = await bcrypt.compare(password, user.password);
      if (!ok) {
        return res
          .status(401)
          .json({ success: false, message: "Invalid credentials" });
      }

      if (user.isVerified === false) {
        const verificationCode = generateVerificationCode();
        const hashedCode = await bcrypt.hash(verificationCode, 10);

        await Administrator.updateOne(
          { _id: user._id },
          {
            $set: {
              verificationToken: hashedCode,
              verificationTokenExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
            },
          },
        );

        try {
          const frontendUrl =
            process.env.NODE_ENV === "development"
              ? process.env.FRONTEND_URL_DEV
              : process.env.FRONTEND_URL_PROD;

          const verificationLink = `${frontendUrl}/verify-email`;
          const fullName =
            user.fullName || `${user.fName ?? ""} ${user.lName ?? ""}`.trim();

          await sendVerificationCodeEmail({
            fullName,
            userEmail: user.email,
            verificationCode,
            verificationLink,
          });
        } catch (mailErr) {
          console.error("Failed to send verification email:", mailErr);
        }

        return res.status(403).json({
          success: false,
          message:
            "Email not verified. Check your inbox/spam for the verification code.",
          needVerification: true,
        });
      }

      const token = generateTokenAndSetCookie(res, user._id, "admin");

      try {
        await Administrator.updateOne(
          { _id: user._id },
          { $set: { lastLoginAt: new Date() } },
        );
      } catch (_) {}

      const safeUser = { ...user };
      delete safeUser.password;
      delete safeUser.verificationToken;
      delete safeUser.verificationTokenExpiresAt;

      return res.status(200).json({
        success: true,
        message: "Login successful",
        token,
        data: safeUser,
      });
    } catch (error) {
      console.error("Admin login error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  // // Login
  // static async login(req, res) {
  //   try {
  //     // Get inputs from the body

  //     const email = req.body?.email?.trim()?.toLowerCase();
  //     const { password } = req.body;

  //     if (!email || !password) {
  //       return res.status(400).json({
  //         success: false,
  //         message: "Email and password are required",
  //       });
  //     }

  //     const user = await findUserByEmailWithPassword(email);

  //     // Dummy compare if not found (prevents user-enumeration timing leak)
  //     if (!user) {
  //       await bcrypt.compare(password || "", DUMMY_PASSWORD_HASH);
  //       return res
  //         .status(400)
  //         .json({ success: false, message: "Invalid credentials" });
  //     }

  //     const ok = await bcrypt.compare(password, user.password);
  //     if (!ok) {
  //       return res
  //         .status(401)
  //         .json({ success: false, message: "Invalid credentials" });
  //     }

  //     // ✅ Email verified check
  //     if (user.isVerified === false) {
  //       const verificationCode = generateVerificationCode();
  //       const hashedCode = await bcrypt.hash(verificationCode, 10);

  //       const Model = ROLE_MODEL_MAP[user.role];
  //       await Model.updateOne(
  //         { _id: user._id },
  //         {
  //           $set: {
  //             verificationToken: hashedCode,
  //             verificationTokenExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
  //           },
  //         },
  //       );

  //       // ✅ Send email
  //       try {
  //         const frontendUrl =
  //           process.env.NODE_ENV === "development"
  //             ? process.env.FRONTEND_URL_DEV
  //             : process.env.FRONTEND_URL_PROD;

  //         const verificationLink = `${frontendUrl}/verify-email`;

  //         const fullName =
  //           user.fullName || `${user.fName ?? ""} ${user.lName ?? ""}`.trim();

  //         await sendVerificationCodeEmail({
  //           fullName,
  //           userEmail: user.email,
  //           verificationCode,
  //           verificationLink,
  //         });
  //       } catch (mailErr) {
  //         console.error("Failed to send verification email:", mailErr);
  //       }

  //       return res.status(403).json({
  //         success: false,
  //         message:
  //           "Email not verified. Check your inbox/spam for the verification code.",
  //         needVerification: true,
  //       });
  //     }

  //     generateTokenAndSetCookie(res, user._id, user.role);

  //     // Update lastLoginAt (best-effort)
  //     try {
  //       const Model = ROLE_MODEL_MAP[user.role];
  //       await Model.updateOne(
  //         { _id: user._id },
  //         { $set: { lastLoginAt: new Date() } },
  //       );
  //     } catch (_) {}

  //     // create a copy of the user object and remove the password from the copy.
  //     const safeUser = { ...user };
  //     delete safeUser.password;
  //     delete safeUser.verificationToken;
  //     delete safeUser.verificationTokenExpiresAt;

  //     return res.status(200).json({
  //       success: true,
  //       message: "Login successful",
  //       data: safeUser,
  //     });
  //   } catch (error) {
  //     console.error("Login error:", error);
  //     return res.status(500).json({ success: false, message: "Server error" });
  //   }
  // }

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

      const hashedPassword = await bcrypt.hash(password, 12);

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

      // Send verification email
      try {
        const frontendUrl =
          process.env.NODE_ENV === "development"
            ? process.env.FRONTEND_URL_DEV
            : process.env.FRONTEND_URL_PROD;

        const verificationLink = `${frontendUrl}/verify-email`;

        await sendVerificationCodeEmail({
          fullName: researcher.fullName,
          userEmail: researcher.email,
          verificationCode,
          verificationLink,
        });
      } catch (mailErr) {
        console.error("Failed to send verification email:", mailErr);
      }

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

  // Admin register
  static async createAdminAccount(req, res) {
    try {
      const { fullName, email, secret } = req.body;

      // 🔐 Secret protection
      if (!secret || secret !== process.env.ADMIN_BOOTSTRAP_SECRET) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized",
        });
      }

      if (!fullName || !email) {
        return res.status(400).json({
          success: false,
          message: "fullName and email are required",
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Prevent duplicates
      // const exists = await Administrator.exists({ email: normalizedEmail });
      const exists = await emailExistsAnywhere(normalizedEmail);
      if (exists) {
        return res.status(409).json({
          success: false,
          message: "This email already exists",
        });
      }

      // Generate password
      const generatedPassword = crypto.randomBytes(8).toString("base64");
      const hashedPassword = await bcrypt.hash(generatedPassword, 12);

      // Create admin
      const admin = await Administrator.create({
        fullName: fullName.trim(),
        email: normalizedEmail,
        password: hashedPassword,
      });

      return res.status(201).json({
        success: true,
        message: "Admin account created successfully.",
        data: {
          id: admin._id,
          email: admin.email,
          fullName: admin.fullName,
          password: generatedPassword,
        },
      });
    } catch (error) {
      console.error("Create admin error:", error);
      return res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }

  // Verify Email
  static async verifyEmail(req, res) {
    try {
      const email = req.body?.email?.trim()?.toLowerCase();
      const { code } = req.body;

      if (!email || !code) {
        return res.status(400).json({
          success: false,
          message: "email and code are required",
        });
      }

      const { user, role } = await findUserByEmailForVerification(email);

      if (!user) {
        return res.status(400).json({
          success: false,
          message: "User not found or token expired",
        });
      }

      const isTokenValid = await bcrypt.compare(code, user.verificationToken);
      if (!isTokenValid) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired token",
        });
      }

      user.isVerified = true;
      user.verificationToken = undefined;
      user.verificationTokenExpiresAt = undefined;
      await user.save();

      // Optional: welcome email
      // try {
      //   const displayName = user.fullName || `${user.fName ?? ""} ${user.lName ?? ""}`.trim();
      //   await sendWelcomeEmail(user.email, displayName);
      // } catch (e) {}

      return res.status(200).json({
        success: true,
        message: "Email verified successfully",
        data: sanitize(user),
        role,
      });
    } catch (error) {
      console.error("verifyEmail error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  // Resending verification code
  static async resendVerificationCode(req, res) {
    try {
      const email = req.body?.email?.trim()?.toLowerCase();

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required",
        });
      }

      // find user in any role
      const researcher = await Researcher.findOne({ email });
      const reviewer = !researcher ? await Reviewer.findOne({ email }) : null;
      const admin =
        !researcher && !reviewer
          ? await Administrator.findOne({ email })
          : null;

      const user = researcher || reviewer || admin;

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (user.isVerified) {
        return res.status(400).json({
          success: false,
          message: "Email is already verified",
        });
      }

      // generate + hash new code
      const verificationCode = generateVerificationCode(); // (your helper already in file)
      const hashedCode = await bcrypt.hash(verificationCode, 10);

      user.verificationToken = hashedCode;
      user.verificationTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
      await user.save();

      // ✅ Send email
      try {
        const frontendUrl =
          process.env.NODE_ENV === "development"
            ? process.env.FRONTEND_URL_DEV
            : process.env.FRONTEND_URL_PROD;

        const verificationLink = `${frontendUrl}/verify-email`;

        const fullName =
          user.fullName || `${user.fName ?? ""} ${user.lName ?? ""}`.trim();

        await sendVerificationCodeEmail({
          fullName,
          userEmail: user.email,
          verificationCode,
          verificationLink,
        });
      } catch (mailErr) {
        console.error("Failed to send verification email:", mailErr);
      }

      return res.status(200).json({
        success: true,
        message:
          "Verification code resent. Please check your inbox and spam folder.",
      });
    } catch (error) {
      console.error("Resend verification code error:", error);
      return res.status(500).json({
        success: false,
        message: "Server error",
      });
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
