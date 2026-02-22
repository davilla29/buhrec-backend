import { transporter } from "./smtp.config.js";
import {
  VERIFICATION_EMAIL_TEMPLATE,
  ACCOUNT_CREATION_EMAIL_TEMPLATE,
} from "./emailTemplates.js";

const senderEmail = '"BUHREC System" <bolarinwadavid3@gmail.com>';
export const sendAccountCreationEmail = async ({
  fullName,
  userEmail,
  generatedPassword,
  loginLink,
}) => {
  try {
    const html = ACCOUNT_CREATION_EMAIL_TEMPLATE({
      userName: fullName,
      userEmail,
      generatedPassword,
      loginLink,
    });
    await transporter.sendMail({
      from: senderEmail,
      to: userEmail,
      subject: "Your Reviewer Account Has Been Created",
      html,
    });
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

export const sendVerificationCodeEmail = async ({
  fullName,
  userEmail,
  verificationCode,
  verificationLink,
}) => {
  try {
    const html = VERIFICATION_EMAIL_TEMPLATE({
      userName: fullName,
      verificationCode,
      verificationLink,
    });

    await transporter.sendMail({
      from: senderEmail,
      to: userEmail,
      subject: "Verify Your Email Address",
      html,
    });
  } catch (error) {
    console.error("Error sending email:", error);
  }
};


export const sendNotificationEmail = async ({
  receiverEmail,
  receiverName,
  title,
  message,
}) => {
  try {
    const html = `
      <h2>Hello ${receiverName},</h2>
      <p>You have a new notification in the BUHREC System.</p>
      <p><strong>${title}</strong></p>
      <p>${message}</p>
      <br/>
      <p>Please login to your dashboard to view more details.</p>
    `;

    await transporter.sendMail({
      from: senderEmail,
      to: receiverEmail,
      subject: "You have a new notification",
      html,
    });
  } catch (error) {
    console.error("Error sending notification email:", error);
  }
};


