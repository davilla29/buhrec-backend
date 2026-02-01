export const VERIFICATION_EMAIL_TEMPLATE = ({
  userName,
  verificationCode,
  verificationLink,
}) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Verify Your Email</title>
</head>

<body style="margin:0; padding:0; font-family: Inter, Arial, sans-serif; background-color:#f8fafc;">

  <!-- Header -->
  <div style="background-color:#2563eb; padding:32px 20px; text-align:center;">
    <h1 style="color:#ffffff; margin:0; font-size:1.6rem; font-weight:600;">
      Verify Your Email
    </h1>
    <p style="color:#dbeafe; margin-top:6px; font-size:0.9rem;">
      BUHREC Research Ethics Portal
    </p>
  </div>

  <!-- Body -->
  <div style="
    background-color:#ffffff;
    max-width:600px;
    margin:24px auto;
    padding:32px;
    border-radius:10px;
    box-shadow:0 6px 18px rgba(0,0,0,0.06);
  ">
    <p style="color:#334155; font-size:0.95rem;">
      Hello <strong>${userName}</strong>,
    </p>

    <p style="color:#334155; font-size:0.95rem; line-height:1.6;">
      Please use the verification code below to confirm your email address.
    </p>

    <!-- Verification Code -->
    <div style="text-align:center; margin:32px 0;">
      <div style="
        display:inline-block;
        background-color:#eff6ff;
        color:#2563eb;
        font-size:1.9rem;
        font-weight:700;
        letter-spacing:8px;
        padding:14px 28px;
        border-radius:10px;
        border:1px solid #bfdbfe;
      ">
        ${verificationCode}
      </div>
    </div>

    <p style="color:#475569; font-size:0.9rem;">
      This code expires in <strong>15 minutes</strong>.
    </p>

    <!-- CTA -->
    <div style="text-align:center; margin:36px 0;">
      <a href="${verificationLink}"
        style="
          background-color:#2563eb;
          color:#ffffff;
          text-decoration:none;
          font-weight:600;
          padding:14px 28px;
          border-radius:8px;
          font-size:0.95rem;
          display:inline-block;
        ">
        Verify Email
      </a>
    </div>

    <p style="color:#64748b; font-size:0.85rem;">
      If you did not create this account, you can safely ignore this email.
    </p>

    <p style="margin-top:32px; color:#334155; font-size:0.9rem;">
      Regards,<br />
      <strong>BUHREC System</strong>
    </p>
  </div>

  <!-- Footer -->
  <div style="text-align:center; margin:20px 0; color:#94a3b8; font-size:0.75rem;">
    <p>This is an automated message. Please do not reply.</p>
  </div>

</body>
</html>
`;

export const ACCOUNT_CREATION_EMAIL_TEMPLATE = ({
  userName,
  userEmail,
  generatedPassword,
  loginLink,
}) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Account Created</title>
</head>

<body style="margin:0; padding:0; font-family: Inter, Arial, sans-serif; background-color:#f8fafc;">

  <!-- Header -->
  <div style="background-color:#2563eb; padding:28px 20px; text-align:center;">
    <h1 style="color:#ffffff; margin:0; font-size:1.5rem; font-weight:600;">
      Account Created Successfully
    </h1>
    <p style="color:#dbeafe; margin-top:6px; font-size:0.9rem;">
      BUHREC Administration Portal
    </p>
  </div>

  <!-- Body -->
  <div style="
    background-color:#ffffff;
    max-width:600px;
    margin:24px auto;
    padding:32px;
    border-radius:10px;
    box-shadow:0 6px 18px rgba(0,0,0,0.06);
  ">

    <p style="color:#334155; font-size:0.95rem;">
      Hello <strong>${userName}</strong>,
    </p>

    <p style="color:#334155; font-size:0.95rem; line-height:1.6;">
      Your account has been created successfully. Below are your login credentials.
      Please keep them secure.
    </p>

    <!-- Credentials Box -->
    <div style="
      margin:24px 0;
      padding:18px;
      background-color:#eff6ff;
      border-radius:8px;
      border:1px solid #bfdbfe;
    ">
      <p style="margin:6px 0;"><strong>Email:</strong> ${userEmail}</p>
      <p style="margin:6px 0;"><strong>Temporary Password:</strong> ${generatedPassword}</p>
    </div>

    <p style="color:#475569; font-size:0.9rem;">
      Please log in immediately and change your password.
    </p>

    <!-- CTA -->
    <div style="text-align:center; margin:32px 0;">
      <a href="${loginLink}"
        style="
          background-color:#2563eb;
          color:#ffffff;
          text-decoration:none;
          font-weight:600;
          padding:14px 28px;
          border-radius:8px;
          font-size:0.95rem;
          display:inline-block;
        ">
        Log In to Your Account
      </a>
    </div>

    <p style="margin-top:32px; color:#334155; font-size:0.9rem;">
      Regards,<br />
      <strong>BUHREC System</strong>
    </p>
  </div>

  <!-- Footer -->
  <div style="text-align:center; margin:20px 0; color:#94a3b8; font-size:0.75rem;">
    <p>This is an automated message. Please do not reply.</p>
  </div>

</body>
</html>
`;
