import { Notification } from "../models/Notification.js";

async function emailExistsAnywhere(email) {
  return (
    (await Researcher.exists({ email })) ||
    (await Reviewer.exists({ email })) ||
    (await Administrator.exists({ email }))
  );
}

class NotificationController {
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
// Get user notifications
