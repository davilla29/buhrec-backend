import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

// import authRoutes from "./routes/auth.route.js";


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
// app.use("/api/auth", authRoutes);

// 404 Handler for unknown API routes
app.use((req, res, next) => {
  if (req.originalUrl.startsWith("/api")) {
    return res
      .status(404)
      .json({ message: "The specified API route does not exist" });
  }
  next();
});

export default app;
