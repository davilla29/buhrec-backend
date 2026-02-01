import { transporter } from "./smtp.config.js";
import { VERIFICATION_EMAIL_TEMPLATE, ACCOUNT_CREATION_EMAIL_TEMPLATE } from "./emailTemplates.js";

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
      to: email,
      subject: "Your Reviewer Account Has Been Created",
      html,
    });
  } catch (error) {
    console.error("Error sending email:", error);
  }
};
