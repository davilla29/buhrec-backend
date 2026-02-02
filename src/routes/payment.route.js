// routes/paymentRoutes.js
import express from "express";
import PaymentController from "../controllers/payment.controller.js"

const router = express.Router();

// Flutterwave redirect callback
router.get("/flutterwave/callback", PaymentController.flutterwaveCallback);

// (Recommended) webhook for reliability
router.post("/flutterwave/webhook", PaymentController.flutterwaveWebhook);

export default router;
