import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  //for gmail Use SMTP
  // service: "smtp.gmail.com",
  //for Godaddy SMTP
  host: "smtpout.secureserver.net",
  port: 465, // use 465 for SSL or 587 for TLS
  secure: true, // true for port 465, false for port 587
  auth: {
    user: process.env.JOBPOLO_COMPANY_EMAIL,
    pass: process.env.JOBPOLO_COMPANY_EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

// Send OTP Verification code for register
export const sendOTPVerification = async ({
  email,
  otp,
  expireOtp,
  otpAction,
}) => {
  try {
    const mailOptions = {
      from: `Job Polo ${process.env.JOBPOLO_COMPANY_EMAIL}`,
      to: email,
      subject: "Verify Your Details - Jobpolo.com",
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9fafb; padding: 30px;">
          <table style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.05); overflow: hidden;">
            <thead style="background-color: #f1f5ff; color: #004aad;">
              <tr>
                <td style="padding: 20px; text-align: center;">
                  <!-- Image now embedded via CID -->
                  <img src="cid:jobpolo_logo" alt="JobPolo Logo" width="120" style="margin-bottom: 8px;" />
                  <h2 style="margin: 0; font-size: 22px; letter-spacing: 0.5px;">Verify Your Email Address</h2>
                </td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 30px; color: #333333;">
                  <p style="font-size: 16px; margin-bottom: 20px;">Hi there,</p>
                  <p style="font-size: 16px; margin-bottom: 15px;">
                    To <b>${otpAction}</b> on <b>Jobpolo.com</b>, please use the verification code below.
                  </p>

                  <div style="text-align: center; margin: 30px 0;">
                    <span style="display: inline-block; font-size: 28px; font-weight: bold; color: #004aad; letter-spacing: 3px; border: 2px dashed #004aad; padding: 10px 25px; border-radius: 8px;">
                      ${otp}
                    </span>
                  </div>

                  <p style="font-size: 15px; margin-bottom: 10px;">
                    This code will expire at <b>${expireOtp}</b>.
                  </p>
                  <p style="font-size: 15px; color: #555;">
                    If you didn’t request this, please ignore this email. Your account remains secure.
                  </p>

                  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />

                  <p style="font-size: 14px; color: #666; text-align: center;">
                    Thank you for choosing <b><a href="https://www.jobpolo.com" target="_blank" style="color: #004aad; text-decoration: none;">JobPolo.com</a></b> — where opportunities meet talent.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background-color: #f4f4f4; text-align: center; padding: 20px; font-size: 13px; color: #999;">
                  <p style="margin: 0;">© ${new Date().getFullYear()} Jobpolo.com. All rights reserved.</p>
                  <p style="margin: 5px 0 0;">Connect with us on 
                    <a href="https://linkedin.com/company/jobpolo" target="_blank" style="color: #004aad; text-decoration: none;">LinkedIn</a>
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      `,
      attachments: [
        {
          filename: "logo.png",
          path: "assets/icons/logo.png",
          cid: "jobpolo_logo",
        },
      ],
    };

    // Check SMTP connection
    transporter.verify((error, success) => {
      if (error) {
        console.error("SMTP Connection Failed:", error);
      } else {
        console.log("SMTP Connection Successful!", success);
      }
    });

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
      message: error.message || "Failed to send OTP",
    };
  }
};
