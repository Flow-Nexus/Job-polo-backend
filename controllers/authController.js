import prismaDB from "../utlis/prisma.js";
import {
  actionCompleteResponse,
  actionFailedResponse,
  generateAccessToken,
  googleClient,
} from "../config/common.js";
import {
  actionType,
  AuthProvider,
  availableActionType,
  responseFlags,
  responseMessages,
  roleType,
  uploadFolderName,
} from "../config/config.js";
import { sendOTPVerification } from "../utlis/helper/helper.js";
import bcrypt from "bcrypt";
import otpGenerator from "otp-generator";
import { processUploadedFiles } from "../cloud/cloudHelper.js";

/**
 * @desc Send OTP for registration or login
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @return {Object} JSON response with success or error message
 * @route POST /api/v1/auth/employee/send-otp
 * @access Public
 */
export const sendOTP = async (req, res) => {
  try {
    const email = req.query.email;
    const action = req.query.action;

    // Validate input
    // const validActions = [...availableActionType];
    if (!email || !action || !availableActionType.includes(action)) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.PARAMETER_MISSING,
        msg: responseMessages.PARAMETER_MISSING,
      });
    }

    // console.log("Send OTP request:", { email, action });

    // Email validation
    const emailRegex =
      /^[\w.%+-]+@([a-zA-Z0-9-]+\.)+(gmail\.com|com|net|org|edu|gov|mil|co\.in|in|co|io|info|biz|tech|me|ai)$/i;
    if (!emailRegex.test(email) || email.length < 5 || email.length > 56) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: responseMessages.BAD_REQUEST,
      });
    }

    // Determine otpAction for storage
    const existingUser = await prismaDB.User.findUnique({ where: { email } });

    // Generate unique OTP
    let otp;
    let existingOTP;

    do {
      otp = otpGenerator.generate(6, {
        upperCaseAlphabets: true,
        specialChars: false,
        lowerCaseAlphabets: false,
      });

      existingOTP = await prismaDB.oTP.findFirst({ where: { otp } });
    } while (existingOTP);

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

    // Delete expired OTPs
    await prismaDB.OTP.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    // Store OTP
    const newOTP = await prismaDB.OTP.create({
      data: {
        email,
        otp,
        action,
        expiresAt,
      },
    });

    // Send OTP via email or mobile
    await sendOTPVerification({
      email: newOTP.email,
      otp: newOTP.otp,
      expireOtp: expiresAt,
    });

    const msg = `OTP for ${action} sent successfully!`;
    return actionCompleteResponse({
      res,
      msg,
      data: {},
    });
  } catch (error) {
    console.error(error, "SendOTP error:");
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      message: error.message || "Error sending OTP!",
    });
  }
};

/**
 * @desc Register Employee with email and OTP
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @return {Object} JSON response with success or error message
 * @route POST /api/v1/auth/employee/register
 * @access Public
 */
export const employeeRegister = async (req, res) => {
  try {
    const userId =
      req.employeeDetails || req.employee_obj_id || "Self-Employee";
    const {
      email,
      firstName,
      lastName,
      countryCode,
      mobileNumber,
      gender,
      city,
      state,
      country,
      pincode,
      industry,
      functionArea,
      currentCTC,
      expectedCTC,
      password,
      confirmPassword,
      TCPolicy,
      otp,
    } = req.body;
    const action = actionType.EMPLOYEE_REGISTER;
    const resumeFiles = req.files?.resumeFiles || [];
    const workSampleFiles = req.files?.workSampleFiles || [];

    // --------- 1. OTP-BASED REGISTRATION FLOW ----------
    if (!email || !firstName || !lastName || !otp) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.PARAMETER_MISSING,
        msg: responseMessages.PARAMETER_MISSING,
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "Invalid email format",
      });
    }

    // Check existing user
    let user = await prismaDB.user.findUnique({ where: { email } });
    if (user) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.CONFLICT,
        msg: "User already registered. Please login instead.",
      });
    }

    // Find latest OTP
    const recentOtp = await prismaDB.OTP.findFirst({
      where: { email, action },
      orderBy: { createdAt: "desc" },
    });

    if (!recentOtp) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.NOT_FOUND,
        msg: "OTP not found or expired",
      });
    }

    // Check OTP expiry
    if (recentOtp.expiresAt < new Date()) {
      await prismaDB.oTP.delete({ where: { id: recentOtp.id } });
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "OTP expired. Please request a new one.",
      });
    }

    // Check OTP match
    if (recentOtp.otp !== otp) {
      await prismaDB.oTP.delete({ where: { id: recentOtp.id } });
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "Invalid OTP",
      });
    }

    // Delete used OTP
    await prismaDB.oTP.delete({ where: { id: recentOtp.id } });

    // ---------- REGISTER NEW USER ----------
    if (!user) {
      // 2️ Create User
      user = await prismaDB.User.create({
        data: {
          email,
          firstName,
          lastName,
          countryCode: countryCode || null,
          mobileNumber: mobileNumber || null,
          role: roleType.EMPLOYEE,
          authProvider: AuthProvider.OTP,
          // addressId: address.id,
          createdBy: userId,
        },
      });

      // 2 Create Address
      await prismaDB.Address.create({
        data: {
          city,
          state,
          country,
          pincode,
          user: { connect: { id: user?.id } },
          createdBy: userId,
        },
      });

      // NEW PART: Handle file uploads
      let resumeUrls = [];
      let resumePreviewUrls = [];
      let workSampleUrls = [];
      let workSamplePreviewUrls = [];
      console.log("resumeFiles", resumeFiles);
      console.log("workSampleFiles", workSampleFiles);
      console.log("email", email);
      if (resumeFiles.length > 0) {
        const resumeResults = await processUploadedFiles(
          resumeFiles,
          uploadFolderName.EMPLOYEE_RESUME,
          email
        );
        resumeUrls = resumeResults.imageUrlsArray;
        resumePreviewUrls = resumeResults.previewUrlsArray;
      }

      if (workSampleFiles.length > 0) {
        const workSampleResults = await processUploadedFiles(
          workSampleFiles,
          uploadFolderName.EMPLOYEE_WORK_SAMPLE,
          email
        );
        workSampleUrls = workSampleResults.imageUrlsArray;
        workSamplePreviewUrls = workSampleResults.previewUrlsArray;
      }

      // 3 Create Employee
      await prismaDB.Employee.create({
        data: {
          userId: user.id,
          industry,
          functionArea,
          currentCTC: currentCTC ? parseFloat(currentCTC) : null,
          expectedCTC: expectedCTC ? parseFloat(expectedCTC) : null,
          resumeUrls,
          gender,
          resumePreviewUrls,
          workSampleUrls,
          workSamplePreviewUrls,
          TCPolicy: TCPolicy === "true" || TCPolicy === true,
          createdBy: userId,
        },
      });

      // 4 Mark user verified
      await prismaDB.UserOTPVerification.create({
        data: {
          otp,
          emailVerified: true,
          expiresAt: new Date(),
          user: {
            connect: { id: user.id },
          },
          createdBy: userId,
        },
      });

      // 5 Hash password if provided
      if (password) {
        if (password.length < 6) {
          return actionFailedResponse({
            res,
            errorCode: responseFlags.BAD_REQUEST,
            msg: "Password must be at least 6 characters long",
          });
        }
        if (password !== confirmPassword) {
          return actionFailedResponse({
            res,
            errorCode: responseFlags.BAD_REQUEST,
            msg: "Password and confirm password do not match",
          });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await prismaDB.ResetPasswordToken.create({
          data: {
            userId: user.id,
            password: hashedPassword,
            previousPassword: [hashedPassword],
            createdBy: userId,
          },
        });
      }
    }

    // Check if active
    if (!user.is_active) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.UNAUTHORIZED,
        msg: "Account is inactive. Please contact admin.",
      });
    }

    //Fetch full user details after creation (including relations)
    const fullUserData = await prismaDB.User.findUnique({
      where: { id: user.id },
      include: {
        address: true,
        employee: true,
        UserOTPVerification: true,
      },
    });

    const msg = `${action} successfully.`;
    return actionCompleteResponse({
      res,
      msg,
      data: { fullUserData },
    });
  } catch (error) {
    console.error("Error in employeeRegister:", error);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      msg: error.message || "Error during registration.",
    });
  }
};

/**
 * @desc Register Employer with email and OTP
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @return {Object} JSON response with success or error message
 * @route POST /api/v1/auth/employer/register
 * @access Public
 */
export const employerRegister = async (req, res) => {
  try {
    const userId =
      req.employerDetails || req.employer_obj_id || "Self-Employer";
    const {
      email,
      firstName,
      lastName,
      countryCode,
      mobileNumber,
      companyName,
      industry,
      functionArea,
      city,
      state,
      country,
      pincode,
      password,
      confirmPassword,
      TCPolicy,
      otp,
    } = req.body;
    const action = actionType.EMPLOYER_REGISTER;

    // --------- 1. OTP-BASED REGISTRATION FLOW ----------
    if (!email || !firstName || !lastName || !otp || !companyName) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.PARAMETER_MISSING,
        msg: responseMessages.PARAMETER_MISSING,
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "Invalid email format",
      });
    }

    // Check existing user
    let user = await prismaDB.User.findUnique({ where: { email } });
    if (user) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.CONFLICT,
        msg: "User already registered. Please login instead.",
      });
    }

    // Find latest OTP
    const recentOtp = await prismaDB.OTP.findFirst({
      where: { email, action },
      orderBy: { createdAt: "desc" },
    });
    // console.log("recentOtp", recentOtp);
    if (!recentOtp) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.NOT_FOUND,
        msg: "OTP not found or expired",
      });
    }

    // Check OTP expiry
    if (recentOtp.expiresAt < new Date()) {
      await prismaDB.OTP.delete({ where: { id: recentOtp.id } });
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "OTP expired. Please request a new one.",
      });
    }

    // Check OTP match
    if (recentOtp.otp !== otp) {
      await prismaDB.OTP.delete({ where: { id: recentOtp.id } });
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "Invalid OTP",
      });
    }

    // Delete used OTP
    await prismaDB.OTP.delete({ where: { id: recentOtp.id } });

    // ---------- REGISTER NEW USER ----------
    if (!user) {
      // 1️ Create User
      user = await prismaDB.User.create({
        data: {
          email,
          firstName,
          lastName,
          countryCode: countryCode || null,
          mobileNumber: mobileNumber || null,
          role: roleType.EMPLOYER,
          authProvider: AuthProvider.OTP,
          createdBy: userId,
        },
      });

      // 2 Create Address
      await prismaDB.Address.create({
        data: {
          city,
          state,
          country,
          pincode,
          user: { connect: { id: user.id } },
          createdBy: userId,
        },
      });

      // 3 Create Employer
      await prismaDB.Employer.create({
        data: {
          userId: user.id,
          companyName,
          industry,
          functionArea,
          TCPolicy: TCPolicy === "true" || TCPolicy === true,
          createdBy: userId,
        },
      });

      // 4 Mark user verified
      await prismaDB.UserOTPVerification.create({
        data: {
          otp,
          emailVerified: true,
          expiresAt: new Date(),
          user: { connect: { id: user.id } },
          createdBy: userId,
        },
      });

      // 5 Hash password if provided
      if (password) {
        if (password.length < 6) {
          return actionFailedResponse({
            res,
            errorCode: responseFlags.BAD_REQUEST,
            msg: "Password must be at least 6 characters long",
          });
        }
        if (password !== confirmPassword) {
          return actionFailedResponse({
            res,
            errorCode: responseFlags.BAD_REQUEST,
            msg: "Password and confirm password do not match",
          });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await prismaDB.ResetPasswordToken.create({
          data: {
            userId: user.id,
            password: hashedPassword,
            previousPassword: [hashedPassword],
            createdBy: userId,
          },
        });
      }
    }

    // Check if active
    if (!user.is_active) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.UNAUTHORIZED,
        msg: "Account is inactive. Please contact admin.",
      });
    }

    //Fetch full user details after creation (including employer relation)
    const fullUserData = await prismaDB.User.findUnique({
      where: { id: user.id },
      include: {
        address: true,
        employer: true,
        UserOTPVerification: true,
      },
    });

    const msg = `${action} successfully.`;
    return actionCompleteResponse({
      res,
      msg,
      data: { fullUserData },
    });
  } catch (error) {
    console.error("Error in employerRegister:", error);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      msg: error.message || "Error during registration.",
    });
  }
};

/**
 * @desc Login For all with email and Password, Email and OTP
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @return {Object} JSON response with success or error message
 * @route POST /api/v1/auth/employee/login
 * @access Public
 */
export const login = async (req, res) => {
  try {
    const { email, password, otp, googleToken } = req.body;
    const action = actionType.LOGIN;

    // ------------------ 1 GOOGLE LOGIN FLOW ------------------
    if (googleToken) {
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: googleToken,
          audience: [
            process.env.JOBPOLO_GOOGLE_ANDROID_CLIENT_ID,
            process.env.JOBPOLO_GOOGLE_WEB_CLIENT_ID,
          ],
        });

        const payload = ticket.getPayload();
        const googleEmail = payload?.email;
        const googleName = payload?.name;

        if (!googleEmail) {
          return actionFailedResponse({
            res,
            errorCode: responseFlags.BAD_REQUEST,
            msg: "Invalid Google token: missing email.",
          });
        }

        // Check if user exists
        let user = await prismaDB.User.findUnique({
          where: { email: googleEmail },
          include: { employee: true, address: true },
        });

        // Register if not exists
        if (!user) {
          const [firstName, lastName] = (googleName || "").split(" ");
          user = await prismaDB.User.create({
            data: {
              email: googleEmail,
              firstName,
              lastName,
              role: roleType.EMPLOYEE,
              authProvider: AuthProvider.GOOGLE,
              is_active: true,
            },
          });

          // Create empty employee record
          await prismaDB.Employee.create({
            data: {
              userId: user.id,
            },
          });

          // Mark email verified
          await prismaDB.UserOTPVerification.create({
            data: {
              userId: user.id,
              otp: null,
              emailVerified: true,
              mobileVerified: false,
              expiresAt: new Date(),
            },
          });
        }

        // Check account active
        if (!user.is_active) {
          return actionFailedResponse({
            res,
            errorCode: responseFlags.UNAUTHORIZED,
            msg: "Account is inactive. Please contact admin.",
          });
        }

        //Generate JWT token
        const tokenPayload = {
          _id: user.id,
          email: user.email,
          role: user.role,
        };

        const token = generateAccessToken(tokenPayload, "30d");

        // Fetch full user info
        const fullUserData = await prismaDB.User.findUnique({
          where: { id: user.id },
          include: {
            employee: true,
            address: true,
            UserOTPVerification: true,
          },
        });

        const msg = "Login with Google successful.";
        return actionCompleteResponse({
          res,
          msg,
          data: {
            token,
            user: fullUserData,
          },
        });
      } catch (err) {
        console.error("Google Login Error:", err);
        return actionFailedResponse({
          res,
          errorCode: responseFlags.BAD_REQUEST,
          msg: err.message || "Google login failed",
        });
      }
    }

    // ------------------ 2 EMAIL + PASSWORD LOGIN ------------------
    if (email && password) {
      const user = await prismaDB.User.findUnique({
        where: { email },
        include: {
          employee: true,
          address: true,
          resetPasswordTokens: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      });

      if (!user) {
        return actionFailedResponse({
          res,
          errorCode: responseFlags.NOT_FOUND,
          msg: "User not found. Please register first.",
        });
      }

      // Use the latest password hash from ResetPasswordToken
      const latestPasswordData = user.resetPasswordTokens?.[0];
      if (!latestPasswordData || !latestPasswordData.password) {
        return actionFailedResponse({
          res,
          errorCode: responseFlags.BAD_REQUEST,
          msg: "Password not set. Please reset your password.",
        });
      }

      const isPasswordValid = await bcrypt.compare(
        password,
        latestPasswordData.password
      );

      if (!isPasswordValid) {
        return actionFailedResponse({
          res,
          errorCode: responseFlags.BAD_REQUEST,
          msg: "Invalid email or password.",
        });
      }

      if (!user.is_active) {
        return actionFailedResponse({
          res,
          errorCode: responseFlags.UNAUTHORIZED,
          msg: "Account is inactive. Please contact admin.",
        });
      }

      // ---------- JWT TOKEN ----------
      const tokenPayload = {
        _id: user.id,
        email: user.email,
        role: user.role,
      };
      const token = generateAccessToken(tokenPayload, "30d");

      const { resetPasswordTokens, ...userWithoutPasswords } = user;

      const msg = "Login successful.";
      return actionCompleteResponse({
        res,
        msg,
        data: { token, user: userWithoutPasswords },
      });
    }

    // ------------------ 3 EMAIL + OTP LOGIN ------------------
    if (email && otp && !password) {
      const user = await prismaDB.User.findUnique({
        where: { email },
        include: { employee: true, address: true },
      });

      if (!user) {
        return actionFailedResponse({
          res,
          errorCode: responseFlags.NOT_FOUND,
          msg: "User not found. Please register first.",
        });
      }

      // ---------- OTP VERIFICATION ----------
      const recentOtp = await prismaDB.OTP.findFirst({
        where: { email, action },
        orderBy: { createdAt: "desc" },
      });
      if (!recentOtp) {
        return actionFailedResponse({
          res,
          errorCode: responseFlags.NOT_FOUND,
          msg: "OTP not found or expired",
        });
      }

      if (recentOtp.expiresAt < new Date()) {
        await prismaDB.OTP.delete({ where: { id: recentOtp.id } });
        return actionFailedResponse({
          res,
          errorCode: responseFlags.BAD_REQUEST,
          msg: "OTP expired. Please request a new one.",
        });
      }

      if (recentOtp.otp !== otp) {
        await prismaDB.OTP.delete({ where: { id: recentOtp.id } });
        return actionFailedResponse({
          res,
          errorCode: responseFlags.BAD_REQUEST,
          msg: "Invalid OTP",
        });
      }

      await prismaDB.OTP.delete({ where: { id: recentOtp.id } });

      if (!user.is_active) {
        return actionFailedResponse({
          res,
          errorCode: responseFlags.UNAUTHORIZED,
          msg: "Account is inactive. Please contact admin.",
        });
      }

      // ---------- JWT TOKEN ----------
      const tokenPayload = {
        _id: user.id,
        email: user.email,
        role: user.role,
      };
      const token = generateAccessToken(tokenPayload, "30d");

      const msg = "Login with OTP successful.";
      return actionCompleteResponse({
        res,
        msg,
        data: { token, user },
      });
    }

    // ------------------ INVALID COMBINATION ------------------
    const msg =
      "Provide valid credentials: either (email+password), (email+otp), or (googleToken).";
    return actionFailedResponse({
      res,
      errorCode: responseFlags.PARAMETER_MISSING,
      msg,
    });
  } catch (error) {
    console.error("Error in login:", error);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      msg: error.message || "Error during login.",
    });
  }
};

/**
 * @desc Reset Password using OTP
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @return {Object} JSON response with success or error message
 * @route PUT /api/v1/auth/employee/reset-password
 * @access Public
 */
export const resetPassword = async (req, res) => {
  try {
    const userby =
      req.employeeDetails ||
      req.employee_obj_id ||
      req.employerDetails ||
      req.employer_obj_id ||
      req.superAdminDetails ||
      req.superAdmin_obj_id;
    const { userId, password, confirmPassword, otp } = req.body;
    const action = actionType.SETPASSWORD;

    if (!userId || !password || !confirmPassword || !otp) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.PARAMETER_MISSING,
        msg: responseMessages.PARAMETER_MISSING,
      });
    }

    if (password !== confirmPassword) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "Password and Confirm Password do not match",
      });
    }

    if (password.length < 6) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "Password must be at least 6 characters long",
      });
    }

    const user = await prismaDB.User.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.NOT_FOUND,
        msg: "User not found.",
      });
    }

    const email = user.email;

    // ---------- OTP VERIFICATION ----------
    const recentOtp = await prismaDB.OTP.findFirst({
      where: { email, action },
      orderBy: { createdAt: "desc" },
    });
    if (!recentOtp) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.NOT_FOUND,
        msg: "OTP not found or expired",
      });
    }

    // Check OTP expiry
    if (recentOtp.expiresAt < new Date()) {
      await prismaDB.oTP.delete({ where: { id: recentOtp.id } });
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "OTP expired. Please request a new one.",
      });
    }

    // Check OTP match
    if (recentOtp.otp !== otp) {
      await prismaDB.OTP.delete({ where: { id: recentOtp.id } });
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "Invalid OTP",
      });
    }

    // Delete used OTP
    await prismaDB.OTP.delete({ where: { id: recentOtp.id } });

    // Fetch existing password record
    const existingPassword = await prismaDB.ResetPasswordToken.findUnique({
      where: { userId },
    });
    if (!existingPassword) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.NOT_FOUND,
        msg: "Password record not found. Cannot reset password.",
      });
    }

    // Check against last 2 passwords + current
    const previousPasswords = existingPassword.previousPassword || [];
    const passwordMatches = await Promise.all(
      [...previousPasswords, existingPassword.password].map((hash) =>
        bcrypt.compare(password, hash)
      )
    );

    if (passwordMatches.includes(true)) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "New password must be different from your last two passwords",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password and maintain last 2 previous passwords
    const newPrevious = [existingPassword.password, ...previousPasswords].slice(
      0,
      2
    );

    await prismaDB.ResetPasswordToken.update({
      where: { userId },
      data: {
        password: hashedPassword,
        previousPassword: newPrevious,
        updatedBy: userby,
      },
    });

    const msg = "Password reset successfully.";
    return actionCompleteResponse({
      res,
      msg,
      data: {},
    });
  } catch (error) {
    console.error("Error in resetPassword:", error);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      msg: error.message || "Error resetting password",
    });
  }
};

/**
 * @desc Forgot Password using email and OTP
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @return {Object} JSON response with success or error message
 * @route POST /api/v1/auth/employee/forgot-password
 * @access Public
 */
export const forgotPassword = async (req, res) => {
  try {
    const { email, password, confirmPassword, otp } = req.body;
    const action = actionType.FORGOTPASSWORD;

    // ---------- PARAMETER VALIDATION ----------
    if (!email || !password || !confirmPassword || !otp) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.PARAMETER_MISSING,
        msg: responseMessages.PARAMETER_MISSING,
      });
    }

    if (password !== confirmPassword) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "Password and Confirm Password do not match",
      });
    }

    if (password.length < 6) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "Password must be at least 6 characters long",
      });
    }

    // ---------- FETCH USER ----------
    const user = await prismaDB.User.findUnique({ where: { email } });
    if (!user) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.NOT_FOUND,
        msg: "User not found",
      });
    }

    const userId = user.id;

    // ---------- OTP VERIFICATION ----------
    const recentOtp = await prismaDB.OTP.findFirst({
      where: { email, action },
      orderBy: { createdAt: "desc" },
    });

    if (!recentOtp) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.NOT_FOUND,
        msg: "OTP not found or expired",
      });
    }

    if (recentOtp.expiresAt < new Date()) {
      await prismaDB.OTP.delete({ where: { id: recentOtp.id } });
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "OTP expired. Please request a new one.",
      });
    }

    if (recentOtp.otp !== otp) {
      await prismaDB.OTP.delete({ where: { id: recentOtp.id } });
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "Invalid OTP",
      });
    }

    // Delete used OTP
    await prismaDB.OTP.delete({ where: { id: recentOtp.id } });

    // ---------- HASH NEW PASSWORD ----------
    const hashedPassword = await bcrypt.hash(password, 10);

    // Fetch existing password record if exists
    const existingPassword = await prismaDB.ResetPasswordToken.findUnique({
      where: { userId },
    });

    let previousPasswords = [];
    if (existingPassword) {
      previousPasswords = [
        existingPassword.password,
        ...(existingPassword.previousPassword || []),
      ].slice(0, 2);

      // Optional: check new password against last 2 passwords
      const passwordMatches = await Promise.all(
        [...previousPasswords].map((hash) => bcrypt.compare(password, hash))
      );
      if (passwordMatches.includes(true)) {
        return actionFailedResponse({
          res,
          errorCode: responseFlags.BAD_REQUEST,
          msg: "New password must be different from your last two passwords",
        });
      }
    }

    // ---------- CREATE NEW PASSWORD RECORD ----------
    await prismaDB.ResetPasswordToken.upsert({
      where: { userId },
      update: {
        password: hashedPassword,
        previousPassword: previousPasswords,
        updatedBy: userby,
      },
      create: {
        userId,
        password: hashedPassword,
        previousPassword: previousPasswords,
        createdBy: userby,
      },
    });

    const msg = "Password Forgot successfully.";
    return actionCompleteResponse({
      res,
      msg,
      data: {},
    });
  } catch (error) {
    console.error("Error in forgotPassword:", error);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      msg: error.message || "Error resetting password",
    });
  }
};

/**
 * @desc Create SuperAdmin using email and OTP
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @return {Object} JSON response with success or error message
 * @route POST /api/v1/auth/super-adminn/register
 * @access Public
 */
export const superAdminRegister = async (req, res) => {
  try {
    const userId =
      req.superAdminDetails || req.superAdmin_obj_id || "Self-Super_Admin";
    console.log("req.body", req.adminDetails, req.admin_obj_id, userId);
    const {
      email,
      firstName,
      lastName,
      countryCode,
      mobileNumber,
      alternativeMobileNumber,
      dob,
      gender,
      city,
      state,
      country,
      pincode,
      linkedinUrl,
      TCPolicy,
      password,
      confirmPassword,
      otp,
    } = req.body;

    const action = actionType.SUPER_ADMIN_REGISTER;
    const portfolioFiles = req.files?.portfolioFiles || [];

    // --------- 1. Required Checks ----------
    if (!email || !firstName || !lastName || !otp) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.PARAMETER_MISSING,
        msg: responseMessages.PARAMETER_MISSING,
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "Invalid email format",
      });
    }

    // --------- 2. Check existing user ----------
    let user = await prismaDB.User.findUnique({ where: { email } });
    if (user) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.CONFLICT,
        msg: "User already registered. Please login instead.",
      });
    }

    // --------- 3. OTP Validation ----------
    const recentOtp = await prismaDB.OTP.findFirst({
      where: { email, action },
      orderBy: { createdAt: "desc" },
    });

    if (!recentOtp) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.NOT_FOUND,
        msg: "OTP not found or expired",
      });
    }

    if (recentOtp.expiresAt < new Date()) {
      await prismaDB.OTP.delete({ where: { id: recentOtp.id } });
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "OTP expired. Please request a new one.",
      });
    }

    if (recentOtp.otp !== otp) {
      await prismaDB.OTP.delete({ where: { id: recentOtp.id } });
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "Invalid OTP",
      });
    }

    // Delete used OTP
    await prismaDB.OTP.delete({ where: { id: recentOtp.id } });

    // ---------- 4. Create New User ----------
    user = await prismaDB.User.create({
      data: {
        email,
        firstName,
        lastName,
        countryCode: countryCode || null,
        mobileNumber: mobileNumber || null,
        alternativeMobileNumber: alternativeMobileNumber || null,
        role: roleType.SUPER_ADMIN,
        authProvider: AuthProvider.OTP,
        createdBy: userId,
      },
    });

    // ---------- 5. Create Address ----------
    await prismaDB.Address.create({
      data: {
        city,
        state,
        country,
        pincode,
        user: { connect: { id: user?.id } },
        createdBy: userId,
      },
    });

    // ---------- 6. Handle File Uploads ----------
    let portfolioUrls = [];
    let portfolioPreviewUrls = [];

    if (portfolioFiles.length > 0) {
      const portfolioResults = await processUploadedFiles(
        portfolioFiles,
        uploadFolderName.SUPER_ADMIN_PORTFOLIO,
        email
      );
      portfolioUrls = portfolioResults.imageUrlsArray;
      portfolioPreviewUrls = portfolioResults.previewUrlsArray;
    }

    // check for dd-mm-yyyy
    let formattedDob = null;

    if (dob) {
      formattedDob = new Date(dob); // Works fine for "2001-09-29"
      if (isNaN(formattedDob.getTime())) {
        formattedDob = null; // fallback if somehow invalid
      }
    }

    // ---------- 7. Create Super Admin ----------
    await prismaDB.SuperAdmin.create({
      data: {
        userId: user.id,
        portfolioUrl: portfolioUrls[0] || null,
        portfolioPreviewUrl: portfolioPreviewUrls[0] || null,
        gender,
        dob: formattedDob || null,
        linkedinUrl,
        TCPolicy: TCPolicy === "true" || TCPolicy === true,
        createdBy: userId,
      },
    });

    // ---------- 8. Mark OTP Verified ----------
    await prismaDB.UserOTPVerification.create({
      data: {
        otp,
        emailVerified: true,
        expiresAt: new Date(),
        user: {
          connect: { id: user.id },
        },
        createdBy: userId,
      },
    });

    // ---------- 9. Set Password ----------
    if (password) {
      if (password.length < 6) {
        return actionFailedResponse({
          res,
          errorCode: responseFlags.BAD_REQUEST,
          msg: "Password must be at least 6 characters long",
        });
      }
      if (password !== confirmPassword) {
        return actionFailedResponse({
          res,
          errorCode: responseFlags.BAD_REQUEST,
          msg: "Password and confirm password do not match",
        });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      await prismaDB.ResetPasswordToken.create({
        data: {
          userId: user.id,
          password: hashedPassword,
          previousPassword: [hashedPassword],
          createdBy: userId,
        },
      });
    }

    // ---------- 10. Final Fetch ----------
    const fullUserData = await prismaDB.User.findUnique({
      where: { id: user.id },
      include: {
        address: true,
        superAdmin: true,
        UserOTPVerification: true,
      },
    });

    const msg = "Super Admin registered successfully.";
    return actionCompleteResponse({
      res,
      msg,
      data: { fullUserData },
    });
  } catch (error) {
    console.error("Error in superAdminRegister:", error);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      msg: error.message || "Error during Super Admin registration.",
    });
  }
};

/**
 * @desc Get User using Many Filters
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @return {Object} JSON response with success or error message
 * @route GET /api/v1/auth/employee/get-users-with-filters
 * @access Public
 */
export const getUsersWithFilters = async (req, res) => {
  try {
    const {
      userId,
      mobileNumber,
      role,
      is_active,
      experience,
      industry,
      functionArea,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    // Convert pagination params
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    // Build Prisma filter dynamically
    const filters = {};

    if (userId) filters.id = userId;
    if (mobileNumber) filters.mobileNumber = mobileNumber;
    if (role) filters.role = role;
    if (is_active !== undefined)
      filters.is_active = is_active === "true" || is_active === true;

    // Optional search filter
    if (search) {
      filters.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { mobileNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    // Fetch users including related data
    const users = await prismaDB.User.findMany({
      where: filters,
      include: {
        address: true,
        employee: true,
        employer: true,
      },
      skip,
      take,
      orderBy: { createdAt: "desc" },
    });

    // Additional filters based on Employee relation (experience, industry, etc.)
    let filteredUsers = users;
    if (experience || industry || functionArea) {
      filteredUsers = users.filter((u) => {
        const emp = u.employee;
        return (
          (!experience || emp?.experience == Number(experience)) &&
          (!industry ||
            emp?.industry?.toLowerCase() === industry?.toLowerCase()) &&
          (!functionArea ||
            emp?.functionArea?.toLowerCase() === functionArea?.toLowerCase())
        );
      });
    }

    const totalCount = await prismaDB.User.count({ where: filters });

    return actionCompleteResponse({
      res,
      msg: "Users fetched successfully",
      data: {
        page: Number(page),
        limit: Number(limit),
        totalCount,
        users: filteredUsers,
      },
    });
  } catch (error) {
    console.error("Error in getAllUsers:", error);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      msg: error.message || "Error fetching users.",
    });
  }
};
