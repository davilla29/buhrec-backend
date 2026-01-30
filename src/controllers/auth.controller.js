import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { Researcher } from "../models/Researcher.js";
import { Reviewer } from "../models/Reviewer.js";
import { Administrator } from "../models/Administrator.js";

const DUMMY_PASSWORD_HASH =
  "$2a$10$CwTycUXWue0Thq9StjUM0uJ8axFzjcxgXmjKPqExE7hFl/jfD2N.G";

const isProduction = process.env.NODE_ENV === "production";
const COOKIE_NAME = "token";

const ROLE_MODEL_MAP = {
  researcher: Researcher,
  reviewer: Reviewer,
  admin: Administrator,
};

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

function signToken({ userId, role }) {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

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

class AuthController {}

export default AuthController;
