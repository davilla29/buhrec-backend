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
  return obj;
}

async function findUserByEmailWithPassword(email) {
  // password is select:false, so select it explicitly
  const r = await Researcher.findOne({ email }).select("+password").lean();
  if (r) return r;

  const v = await Reviewer.findOne({ email }).select("+password").lean();
  if (v) return v;

  const a = await Administrator.findOne({ email }).select("+password").lean();
  if (a) return a;

  return null;
}

async function emailExistsAnywhere(email) {
  return (
    (await Researcher.exists({ email })) ||
    (await Reviewer.exists({ email })) ||
    (await Administrator.exists({ email }))
  );
}

class AuthController {
  // Login
  static async login(req, res) {
    try {
      // Get inputs from the body
      const { email, password } = req.body;

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

      generateTokenAndSetCookie(res, user._id, user.role);

      // Update lastLoginAt (best-effort)
      try {
        const Model = ROLE_MODEL_MAP[user.role];
        await Model.updateOne(
          { _id: user._id },
          { $set: { lastLoginAt: new Date() } },
        );
      } catch (_) {}

      const safeUser = { ...user };
      delete safeUser.password;

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
}

export default AuthController;
