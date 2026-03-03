// import { transporter } from "./smtp.config.js";
// import {
//   VERIFICATION_EMAIL_TEMPLATE,
//   ACCOUNT_CREATION_EMAIL_TEMPLATE,
//   NOTIFICATION_EMAIL_TEMPLATE,
// } from "./emailTemplates.js";

// const senderEmail = '"BUHREC System" <bolarinwadavid3@gmail.com>';
// export const sendAccountCreationEmail = async ({
//   fullName,
//   userEmail,
//   title,
//   generatedPassword,
//   loginLink,
//   profileImageUrl,
// }) => {
//   try {
//     const html = ACCOUNT_CREATION_EMAIL_TEMPLATE({
//       userName: fullName,
//       userEmail,
//       title,
//       generatedPassword,
//       loginLink,
//       profileImageUrl,
//     });
//     await transporter.sendMail({
//       from: senderEmail,
//       to: userEmail,
//       subject: "Your Reviewer Account Has Been Created",
//       html,
//     });
//   } catch (error) {
//     console.error("Error sending email:", error);
//   }
// };

// export const sendVerificationCodeEmail = async ({
//   fullName,
//   userEmail,
//   verificationCode,
//   verificationLink,
// }) => {
//   try {
//     const html = VERIFICATION_EMAIL_TEMPLATE({
//       userName: fullName,
//       verificationCode,
//       verificationLink,
//     });

//     await transporter.sendMail({
//       from: senderEmail,
//       to: userEmail,
//       subject: "Verify Your Email Address",
//       html,
//     });
//   } catch (error) {
//     console.error("Error sending email:", error);
//   }
// };

// export const sendNotificationEmail = async ({
//   receiverEmail,
//   receiverName,
//   title,
//   message,
// }) => {
//   try {
//     const html = NOTIFICATION_EMAIL_TEMPLATE({
//       receiverName,
//       title,
//       message,
//     });

//     await transporter.sendMail({
//       from: senderEmail,
//       to: receiverEmail,
//       subject: `New Notification: ${title}`,
//       html,
//     });
//   } catch (error) {
//     console.error("Error sending notification email:", error);
//   }
// };

import { mailjet } from "./mailjet.config.js";
import {
  VERIFICATION_EMAIL_TEMPLATE,
  ACCOUNT_CREATION_EMAIL_TEMPLATE,
  NOTIFICATION_EMAIL_TEMPLATE,
} from "./emailTemplates.js";

export const sendAccountCreationEmail = async ({
  fullName,
  userEmail,
  title,
  generatedPassword,
  loginLink,
  profileImageUrl,
}) => {
  const html = ACCOUNT_CREATION_EMAIL_TEMPLATE({
    userName: fullName,
    userEmail,
    title,
    generatedPassword,
    loginLink,
    profileImageUrl,
  });
  try {
    const result = await mailjet.post("send", { version: "v3.1" }).request({
      Messages: [
        {
          From: {
            Email: process.env.MAIL_FROM,
            Name: process.env.MAIL_FROM_NAME || "BUHREC",
          },
          To: [{ Email: userEmail, Name: fullName }],
          Subject: "Your Reviewer Account Has Been Created",
          HTMLPart: html,
        },
      ],
    });

    return result.body;
  } catch (error) {
    console.error("Mailjet API error:", err?.response?.data || err);
    throw err;
  }
};

export const sendVerificationCodeEmail = async ({
  fullName,
  userEmail,
  verificationCode,
  verificationLink,
}) => {
  const html = VERIFICATION_EMAIL_TEMPLATE({
    userName: fullName,
    verificationCode,
    verificationLink,
  });
  try {
    const result = await mailjet.post("send", { version: "v3.1" }).request({
      Messages: [
        {
          From: {
            Email: process.env.MAIL_FROM,
            Name: process.env.MAIL_FROM_NAME || "BUHREC",
          },
          To: [{ Email: userEmail, Name: fullName }],
          Subject: "Verify Your Email Address",
          HTMLPart: html,
        },
      ],
    });

    return result.body;
  } catch (error) {
    console.error("Mailjet API error:", err?.response?.data || err);
    throw err;
  }
};

export const sendNotificationEmail = async ({
  receiverEmail,
  receiverName,
  title,
  message,
}) => {
  const html = NOTIFICATION_EMAIL_TEMPLATE({
    receiverName,
    title,
    message,
  });

  try {
    const result = await mailjet.post("send", { version: "v3.1" }).request({
      Messages: [
        {
          From: {
            Email: process.env.MAIL_FROM,
            Name: process.env.MAIL_FROM_NAME || "BUHREC",
          },
          To: [{ Email: receiverEmail, Name: receiverName }],
          Subject: `New Notification: ${title}`,
          HTMLPart: html,
        },
      ],
    });

    return result.body;
  } catch (error) {
    console.error("Mailjet API error:", err?.response?.data || err);
    throw err;
  }
};
