import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "smtp.gmail.com",
  auth: {
    user: process.env.JOBPOLO_COMPANY_EMAIL,
    pass: process.env.JOBPOLO_COMPANY_EMAIL_PASSWORD,
  },

  tls: {
    rejectUnauthorized: false,
  },
});

// Send OTP Verification code for register
export const sendOTPVerification = async ({ email, otp, expireOtp }) => {
  try {
    const mailOptions = {
      from: process.env.JOBPOLO_COMPANY_EMAIL,
      to: email,
      subject: "Verify Your Email.",
      html: `
        <p>Enter <b>${otp}</b> to verify your email address and complete the process.</p>
        <p>This code <b>expires in ${expireOtp} minutes</b>.</p>
      `,
    };
    // Send email OTP
    await transporter.sendMail(mailOptions);
    // console.log(`OTP sent to email: ${email}`);
    return {
      success: true,
      message: "OTP sent successfully!",
    };
  } catch (error) {
    console.error(error.message || "OTP sending error.");
    return {
      success: false,
      message: "Failed to send OTP",
      error: error.message,
    };
  }
};

//send reset password success email
export const sendResetPasswordEmail = async ({
  email,
  name,
  newPassword,
  msgtype,
}) => {
  try {
    const mailOptions = {
      from: process.env.MRSC_COMPANY_EMAIL,
      to: email,
      subject: `Password ${msgtype} Successful`,
      html: `
        <p>Hi ${name},</p>  
        <p>Your password has been successfully ${msgtype}.</p>
        <p>Your new password is: <b>${newPassword}</b></p>
        <>Please keep it safe and do not share it with anyone.  </p>
        <p>If you did not request this change, please contact support immediately.</p>
        <p>Thank you!</p>
        <p>Best regards,</p>
        <p>MRSC Team</p>
      `,
    };

    // Send reset password email
    await transporter.sendMail(mailOptions);
    console.log(`${msgtype} password email sent to: ${email}`);
    return {
      success: true,
      message: `${msgtype} password email sent successfully!`,
    };
  } catch (error) {
    console.error(error.message || `${msgtype} password email sending error.`);
    return {
      success: false,
      error: error.message,
    };
  }
};

