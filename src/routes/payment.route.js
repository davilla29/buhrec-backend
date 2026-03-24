import express from "express";
import PaymentController from "../controllers/payment.controller.js";

const router = express.Router();

// Flutterwave redirect callback
router.get("/flutterwave/callback", PaymentController.flutterwaveCallback);

export default router;
