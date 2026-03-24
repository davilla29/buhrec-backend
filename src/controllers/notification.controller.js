import { Notification } from "../models/Notification.js";
import { Researcher } from "../models/Researcher.js";
import { Reviewer } from "../models/Reviewer.js";
import { Administrator } from "../models/Administrator.js";
import { sendNotificationEmail } from "../mail/emailService.js";

class NotificationController {
  // Create notification
  static async createNotification({
    title,
    message,
    proposalId,
    senderId,
    senderModel,
    receiverId,
    receiverModel,
  }) {
    try {
      // Save in DB
      const notification = await Notification.create({
        title,
        message,
        proposalId,
        sender: senderId,
        senderModel,
        receiver: receiverId,
        receiverModel,
      });

      // Get receiver model dynamically
      let receiverModelRef;

      if (receiverModel === "Researcher") receiverModelRef = Researcher;
      if (receiverModel === "Reviewer") receiverModelRef = Reviewer;
      if (receiverModel === "Administrator") receiverModelRef = Administrator;

      const receiver = await receiverModelRef.findById(receiverId);

      // Send email
      if (receiver?.email) {
        await sendNotificationEmail({
          receiverEmail: receiver.email,
          receiverName: receiver.fullName || "User",
          receiverTitle: receiver.title || "",
          title,
          message,
        });
      }

      return notification;
    } catch (error) {
      throw new Error(error);
    }
  }

  // Get logged-in user's notifications
  static async getMyNotifications(req, res) {
    try {
      const notifications = await Notification.find({
        receiver: req.userId,
      })
        .populate("proposalId", "title applicationId status")
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        data: notifications,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Mark as read
  static async markAsRead(req, res) {
    try {
      const { id } = req.params;

      await Notification.findByIdAndUpdate(id, {
        isRead: true,
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}

export default NotificationController;
