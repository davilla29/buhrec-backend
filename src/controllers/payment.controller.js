import { Proposal } from "../models/Proposal.js";
import axios from "axios"; 

class PaymentController {
  // Flutterwave redirect callback: /flutterwave/callback?status=successful&tx_ref=...&transaction_id=...
  static async flutterwaveCallback(req, res) {
    try {
      const { status, tx_ref, transaction_id } = req.query;

      if (!tx_ref || !transaction_id) {
        return res.status(400).send("Missing tx_ref or transaction_id");
      }

      // 1. Find the proposal based on tx_ref
      const proposal = await Proposal.findOne({ "payment.txRef": tx_ref });

      if (!proposal) {
        return res.status(404).send("Proposal not found for tx_ref");
      }

      // 2. Verify the transaction directly with Flutterwave API
      const response = await axios.get(
        `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`,
        {
          headers: {
            Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
          },
        },
      );

      const verification = response.data.data;

      const vStatus = verification.status;
      const amount = Number(verification.amount);
      const currency = verification.currency;
      const verifiedTxRef = verification.tx_ref;

      // 3. Check if verification matches our expectations
      if (
        vStatus === "successful" &&
        amount === 7000 &&
        currency === "NGN" &&
        verifiedTxRef === proposal.payment.txRef
      ) {
        // Update proposal payment details
        proposal.payment.status = "paid";
        proposal.payment.flutterwaveTransactionId = String(transaction_id);
        proposal.payment.paidAt = new Date();
        proposal.payment.raw = verification;

        // Move proposal to Paid (ready to submit)
        proposal.status = "Paid";

        await proposal.save();

        // Redirect back to your frontend success screen
        return res.redirect(
          `${process.env.FRONTEND_URL_DEV}/payment-success?proposalId=${proposal._id}`,
        );
      }

      // 4. If verification failed or amounts don't match
      proposal.payment.status = "failed";
      proposal.payment.raw = verification;
      await proposal.save();

      return res.redirect(
        `${process.env.FRONTEND_URL_DEV}/payment-failed?proposalId=${proposal._id}`,
      );
    } catch (err) {
      console.log(
        "flutterwaveCallback error:",
        err?.response?.data || err.message,
      );
      return res.status(500).send("Server error during payment verification");
    }
  }
}

export default PaymentController;
