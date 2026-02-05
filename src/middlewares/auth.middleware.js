import jwt from "jsonwebtoken";
import { Researcher } from "../models/Researcher.js";
import { Administrator } from "../models/Administrator.js";
import { Reviewer } from "../models/Reviewer.js";

export const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Unauthorized! Kindly login" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    let user =
      (await Researcher.findById(decoded.userId).select("-password").lean()) ||
      (await Reviewer.findById(decoded.userId).select("-password").lean()) ||
      (await Administrator.findById(decoded.userId).select("-password").lean());

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized - user not found" });
    }

    req.user = user;
    req.userId = decoded.userId;
    req.userRole = user.role;

    next();
  } catch (error) {
    if (
      error.name === "TokenExpiredError" ||
      error.name === "JsonWebTokenError"
    ) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - invalid or expired token",
      });
    }

    console.log("Error in verifyToken", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const isAdmin = (req, res, next) => {
  if (req.userRole !== "admin") {
    return res
      .status(403)
      .json({ message: "Only admins can perform this action" });
  }
  next();
};

export const isResearcher = (req, res, next) => {
  if (req.userRole !== "researcher")
    return res.status(403).json({
      success: false,
      message: "Only Researchers can perform the action",
    });
  next();
};

export const isReviewer = (req, res, next) => {
  if (req.userRole !== "researcher")
    return res
      .status(403)
      .json({
        success: false,
        message: "Only Reviewers can perform the action",
      });
  next();
};
