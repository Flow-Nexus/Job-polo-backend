import nodemailer from "nodemailer";
import twilio from "twilio";
import dotenv from "dotenv";

dotenv.config();

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MRSC_COMPANY_EMAIL,
    pass: process.env.MRSC_COMPANY_EMAIL_PASSWORD,
  },

  tls: {
    rejectUnauthorized: false,
  },
});

// Twilio client setup
// const twilioClient = twilio(
//   process.env.TWILIO_ACCOUNT_SID,
//   process.env.TWILIO_AUTH_TOKEN
// );

// Send OTP Verification code for register
export const sendOTPVerification = async ({ email, otp, expireOtp }) => {
  try {
    const mailOptions = {
      from: process.env.MRSC_COMPANY_EMAIL,
      to: email,
      subject: "Verify Your Email.",
      html: `
        <p>Enter <b>${otp}</b> in the app to verify your email address and complete the process.</p>
        <p>This code <b>expires in ${expireOtp} minutes</b>.</p>
      `,
    };
    // Send email OTP
    await transporter.sendMail(mailOptions);
    console.log(`OTP sent to email: ${email}`);
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

//Order Confirmation Send to Operator
export const sendOrderStatusToOperator = async ({ order, operator }) => {
  try {
    const operatorEmail = operator?.email;
    if (!operatorEmail) {
      console.warn(`Operator email not found for orderId: ${order.orderId}`);
      return {
        success: false,
        message: "Operator email not found",
      };
    }

    const mailOptions = {
      from: process.env.MRSC_COMPANY_EMAIL,
      to: operatorEmail,
      subject: `New Order Confirmed - ${order.orderId}`,
      html: `
        <h2>Hello ${operator?.name || "Operator"},</h2>
        <p>A new order (<strong>${
          order.orderId
        }</strong>) has been successfully confirmed and paid.</p>
        <p><strong>Total Price:</strong> ₹${order.totalPrice}</p>
        <p><strong>Delivery Address:</strong> 
          ${order.deliveryAddress?.area || ""}, ${
        order.deliveryAddress?.city || ""
      }
        </p>
        <br/>
        <p>Please prepare the order for dispatch.</p>
      `,
    };

    // Send order status email
    await transporter.sendMail(mailOptions);
    console.log(`Order status email sent to operator: ${operatorEmail}`);

    return {
      success: true,
      message: "Order status email sent successfully",
    };
  } catch (error) {
    console.error(`Failed to send order status email: ${error.message}`);
    return {
      success: false,
      message: "Failed to send order status email",
      error: error.message,
    };
  }
};
