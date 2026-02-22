// controllers/paymentController.js
import { Proposal } from "../models/Proposal.js";

class PaymentController {
  // Flutterwave redirect callback: /flutterwave/callback?status=successful&tx_ref=...&transaction_id=...
  static async flutterwaveCallback(req, res) {
    try {
      const { status, tx_ref, transaction_id } = req.query;

      if (!tx_ref || !transaction_id) {
        return res.status(400).send("Missing tx_ref or transaction_id");
      }

      // Always verify from your server with Flutterwave secret key
      const verification =
        await req.flutterwave.verifyTransaction(transaction_id);

      // Example fields (depends on your service wrapper):
      const vStatus = verification?.status;
      const amount = Number(verification?.amount);
      const currency = verification?.currency;
      const txRef = verification?.tx_ref;

      const proposal = await Proposal.findOne({ "payment.txRef": tx_ref });
      if (!proposal)
        return res.status(404).send("Proposal not found for tx_ref");

      if (
        vStatus === "successful" &&
        amount === 7000 &&
        currency === "NGN" &&
        txRef === proposal.payment.txRef
      ) {
        proposal.payment.status = "paid";
        proposal.payment.flutterwaveTransactionId = String(transaction_id);
        proposal.payment.paidAt = new Date();
        proposal.payment.raw = verification;

        // Move proposal to Paid (locked, ready to submit)
        proposal.status = "Paid";

        await proposal.save();

        // Redirect back to your frontend success screen
        return res.redirect(
          `${process.env.FRONTEND_URL}/payment-success?proposalId=${proposal._id}`,
        );
      }

      // failed
      proposal.payment.status = "failed";
      proposal.payment.raw = verification;
      await proposal.save();

      return res.redirect(
        `${process.env.FRONTEND_URL}/payment-failed?proposalId=${proposal._id}`,
      );
    } catch (err) {
      console.log("flutterwaveCallback error:", err);
      return res.status(500).send("Server error");
    }
  }

  // Webhook is more reliable than redirect-only
  static async flutterwaveWebhook(req, res) {
    try {
      // Verify webhook signature per Flutterwave docs (hash header)
      // if invalid signature -> 401

      const event = req.body;

      const secretHash = process.env.FLUTTERWAVE_SECRET_HASH;

      const signature = req.headers["verif-hash"];

      if (!signature || signature !== secretHash) {
        return res.status(401).send("Invalid webhook signature");
      }

      // Extract tx_ref and transaction id from event data
      const tx_ref = event?.data?.tx_ref;
      const transaction_id = event?.data?.id;

      if (!tx_ref || !transaction_id) return res.sendStatus(200);

      const proposal = await Proposal.findOne({ "payment.txRef": tx_ref });
      if (!proposal) return res.sendStatus(200);

      // Verify transaction on your server
      const verification =
        await req.flutterwave.verifyTransaction(transaction_id);

      const vStatus = verification?.status;
      const amount = Number(verification?.amount);
      const currency = verification?.currency;

      if (vStatus === "successful" && amount === 7000 && currency === "NGN") {
        if (proposal.payment.status !== "paid") {
          proposal.payment.status = "paid";
          proposal.payment.flutterwaveTransactionId = String(transaction_id);
          proposal.payment.paidAt = new Date();
          proposal.payment.raw = verification;
          proposal.status = "Paid";
          await proposal.save();
        }
      }

      return res.sendStatus(200);
    } catch (err) {
      console.log("flutterwaveWebhook error:", err);
      return res.sendStatus(200); // webhooks should usually return 200
    }
  }
}

export default PaymentController;
