import { Notification } from "../models/Notification.js";
import { Researcher } from "../models/Researcher.js";
import { Reviewer } from "../models/Reviewer.js";
import { Administrator } from "../models/Administrator.js";
import { sendNotificationEmail } from "../mail/emailService.js";

class NotificationController {
  static async createNotification({
    title,
    message,
    proposalId,
    senderId,
    receiverId,
  }) {
    try {
      // 1️⃣ Save notification in DB
      const notification = await Notification.create({
        title,
        message,
        proposalId,
        sender: senderId,
        receiver: receiverId,
      });

      // 2️⃣ Find receiver in any model
      let receiver =
        (await Researcher.findById(receiverId)) ||
        (await Reviewer.findById(receiverId)) ||
        (await Administrator.findById(receiverId));

      // 3️⃣ Send Email
      if (receiver?.email) {
        await sendNotificationEmail({
          receiverEmail: receiver.email,
          receiverName: receiver.fullName || "User",
          title,
          message,
        });
      }

      return notification;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  static async getMyNotifications(req, res) {
    try {
      const notifications = await Notification.find({
        receiver: req.user.id,
      }).sort({ createdAt: -1 });

      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}

export default NotificationController;
