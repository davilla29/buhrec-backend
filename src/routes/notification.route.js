import express from "express";
import NotificationController from "../controllers/notification.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", verifyToken, NotificationController.getMyNotifications);

export default router;
