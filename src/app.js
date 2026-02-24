import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

import authRoutes from "./routes/auth.route.js";
import adminRoutes from "./routes/admin.route.js";
import researcherRoutes from "./routes/researcher.route.js";
import reviewerRoutes from "./routes/reviewer.route.js";
import paymentRoutes from "./routes/payment.route.js";
import notificationRoutes from "./routes/notification.route.js";

const app = express();

const allowedOrigins = ["http://localhost:5173"];

// Middleware
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/researcher", researcherRoutes);
app.use("/api/reviewer", reviewerRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/notifications", notificationRoutes);

// 404 Handler for unknown API routes
app.use((req, res, next) => {
  if (req.originalUrl.startsWith("/api")) {
    return res
      .status(404)
      .json({ message: "The specified API route does not exist" });
  }
  next();
});

// Global error handler (MUST be after routes)
app.use((err, req, res, next) => {
  console.error("Global Error:", err.message);

  if (err.message === "Only JPG, PNG, or WEBP images are allowed") {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "File size exceeds 5MB limit",
    });
  }

  return res.status(500).json({
    success: false,
    message: "Something went wrong",
  });
});

export default app;
