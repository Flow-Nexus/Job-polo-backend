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
    const files = req.files || [];

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
      // 1 Create Address
      const address = await prismaDB.Address.create({
        data: {
          city,
          state,
          country,
          pincode,
        },
      });

      // 2️ Create User
      user = await prismaDB.User.create({
        data: {
          email,
          firstName,
          lastName,
          countryCode,
          mobileNumber,
          gender,
          role: roleType.EMPLOYEE,
          authProvider: AuthProvider.OTP,
          addressId: address.id,
        },
      });

      // NEW PART: Handle file uploads
      let resumeUrls = [];
      let resumePreviewUrls = [];

      if (files && files.length > 0) {
        const uploadResults = await processUploadedFiles(
          files,
          `${firstName}_${lastName}`,
          "employee-resumes"
        );
        resumeUrls = uploadResults.imageUrlsArray;
        resumePreviewUrls = uploadResults.previewUrlsArray;
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
          resumePreviewUrls,
          TCPolicy,
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

    console.log(firstName, lastName, email, action, otp, email, action);


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
    console.log("dfgthj",firstName, lastName, email, action, otp, email, action);
    console.log("recentOtp", recentOtp);
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
        },
      });

      // 1 Create Address
      const address = await prismaDB.Address.create({
        data: {
          city,
          state,
          country,
          pincode,
        },
      });

      // 2 Create Employer
      await prismaDB.Employer.create({
        data: {
          userId: user.id,
          companyName,
          industry,
          functionArea,
          TCPolicy,
        },
      });

      // 3 Mark user verified
      await prismaDB.UserOTPVerification.create({
        data: {
          otp,
          emailVerified: true,
          expiresAt: new Date(),
          user: { connect: { id: user.id } },
        },
      });

      // 4 Hash password if provided
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
        Employer: true,
        address: true,
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

export const login = async (req, res) => {
  try {
    const { email, password, otp, googleToken } = req.body;
    // const action = actionType;

    // 1. GOOGLE LOGIN FLOW
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
          const nameParts = googleName?.split(" ") || [];
          user = await prismaDB.User.create({
            data: {
              email: googleEmail,
              firstName: nameParts[0] || "",
              lastName: nameParts[1] || "",
              role: roleType.EMPLOYEE,
              authProvider: AuthProvider.GOOGLE,
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

    //2. NORMAL LOGIN (Email/Password)
    if (!email || !password || !otp) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.PARAMETER_MISSING,
        msg: responseMessages.PARAMETER_MISSING,
      });
    }

    const user = await prismaDB.User.findUnique({
      where: { email },
      include: {
        employee: true,
        address: true,
        resetPasswordTokens: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
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
        msg: "Invalid credentials.",
      });
    }

    // ---------- OTP VERIFICATION ----------
    const recentOtp = await prismaDB.OTP.findFirst({
      where: { email },
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

    // ---------- ACCOUNT ACTIVE CHECK ----------
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
      data: {
        token,
        user: userWithoutPasswords,
      },
    });
  } catch (error) {
    console.error("Error in employeeLogin:", error);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      msg: error.message || "Error during login.",
    });
  }
};

// //For password verified for reset password
// // ---------- PASSWORD HANDLING ----------
//     if (password && confirmPassword) {
//       if (password !== confirmPassword) {
//         return actionFailedResponse({
//           res,
//           errorCode: responseFlags.BAD_REQUEST,
//           msg: "Password and Confirm Password do not match",
//         });
//       }

//       const hashedPassword = await bcrypt.hash(password, 10);

//       const existingPasswordRecord = await prismaDB.employeePassword.findUnique({
//         where: { userId: user.id },
//       });

//       if (existingPasswordRecord) {
//         // Check if same as last 2 passwords
//         const sameAsOld = await Promise.all(
//           existingPasswordRecord.previousHashes.map((oldHash) =>
//             bcrypt.compare(password, oldHash)
//           )
//         );
//         const sameAsCurrent = await bcrypt.compare(password, existingPasswordRecord.passwordHash);

//         if (sameAsOld.includes(true) || sameAsCurrent) {
//           return actionFailedResponse({
//             res,
//             errorCode: responseFlags.BAD_REQUEST,
//             msg: "New password must be different from your last two passwords",
//           });
//         }

//  const existingPassword = await prismaDB.employeePassword.findUnique({
//           where: { userId: user.id },
//         });
//         // Update password and store previous ones
//         const newPrevious = [
//           existingPasswordRecord.passwordHash,
//           ...(existingPasswordRecord.previousHashes || []),
//         ].slice(0, 2);

//         await prismaDB.employeePassword.update({
//           where: { userId: user.id },
//           data: {
//             passwordHash: hashedPassword,
//             previousHashes: newPrevious,
//           },
//         });
//       } else {
//         // Create new password entry
//         await prismaDB.employeePassword.create({
//           data: {
//             userId: user.id,
//             passwordHash: hashedPassword,
//           },
//         });
//       }
//     } else {
//       return actionFailedResponse({
//         res,
//         errorCode: responseFlags.PARAMETER_MISSING,
//         msg: "Password and Confirm Password are required",
//       });
//     }
// const existingPassword = await prismaDB.employeePassword.findUnique({
//           where: { userId: user.id },
//         });

//         const salt = await bcrypt.genSalt(10);
//         const hashedPassword = await bcrypt.hash(password, salt);

//         // Check last 2 passwords
//         // if (existingPassword) {
//         //   const recentPasswords = existingPassword.previousPassword || [];

//         //   for (const previousHash of recentPasswords) {
//         //     const isSame = await bcrypt.compare(password, previousHash);
//         //     if (isSame) {
//         //       return actionFailedResponse({
//         //         res,
//         //         errorCode: responseFlags.BAD_REQUEST,
//         //         msg: "New password must be different from your last 2 passwords.",
//         //       });
//         //     }
//         //   }

//         //   const updatedPasswords = [hashedPassword, ...recentPasswords].slice(
//         //     0,
//         //     2
//         //   );

//         //   await prismaDB.ResetPasswordToken.update({
//         //     where: { userId: user.id },
//         //     data: {
//         //       password: hashedPassword,
//         //       previousPassword: updatedPasswords,
//         //     },
//         //   });
//         // } else {
//         await prismaDB.ResetPasswordToken.create({
//           data: {
//             userId: user.id,
//             password: hashedPassword,
//             previousPassword: [hashedPassword],
//           },
//         });
//         // }
//       }
//     }

//for login token
// Generate JWT token
// const tokenPayload = {
//   _id: user.id,
//   email: user.email,
//   role: user.role,
// };

// const token = generateAccessToken(tokenPayload, "30d");

///dfghjk

// --------- 1. GOOGLE SIGN-IN FLOW ----------
// if (googleToken) {
//   try {
//     const ticket = await googleClient.verifyIdToken({
//       idToken: googleToken,
//       audience: [
//         process.env.JOBPOLO_GOOGLE_ANDROID_CLIENT_ID,
//         process.env.JOBPOLO_GOOGLE_WEB_CLIENT_ID,
//       ],
//     });

//     const payload = ticket.getPayload();
//     const googleEmail = payload?.email;
//     const googleName = payload?.name + " ";

//     if (!googleEmail || !googleName) {
//       return actionFailedResponse({
//         res,
//         errorCode: responseFlags.BAD_REQUEST,
//         msg: "Invalid Google token",
//       });
//     }

//     // Check if user exists
//     let user = await prismaDB.user.findUnique({
//       where: { email: googleEmail },
//     });

//     // Create new user if not found
//     if (!user) {
//       const [first, last] = googleName.split(" ");
//       user = await prismaDB.user.create({
//         data: {
//           email: googleEmail,
//           firstName: first || "",
//           lastName: last || "",
//           role: roleType.EMPLOYEE,
//           authProvider: AuthProvider.GOOGLE,
//         },
//       });
//     }

//     // Check if user is active
//     if (!user.is_active) {
//       return actionFailedResponse({
//         res,
//         errorCode: responseFlags.UNAUTHORIZED,
//         msg: "Account is inactive. Please contact admin.",
//       });
//     }
//     // const { password, ...userWithoutPassword } = user;

//     const msg = "Register in with Google successfully.";
//     return actionCompleteResponse({
//       res,
//       msg,
//       data: { user },
//     });
//   } catch (err) {
//     console.error("Google auth failed:", err);
//     return actionFailedResponse({
//       res,
//       errorCode: responseFlags.BAD_REQUEST,
//       msg: err.message || "Google authentication failed",
//     });
//   }
// }
