//send otp to register/login user
/**
 * @desc Send OTP for user registration or login
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @return {Object} JSON response with success or error message
 * @route GET /api/v1/auth/send-otp
 * @access Public
 */
export const sendOTP = async (req, res) => {
  try {
    const email = req.query.email;
    const action = req.query.action;

    // Validate input
    const validActions = [
      "login",
      "register",
      "set_password",
      "register_and_login",
      "forgot_password",
    ];
    if (!email || !action || !validActions.includes(action)) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.PARAMETER_MISSING,
        msg: responseMessages.PARAMETER_MISSING,
      });
    }

    console.log("Send OTP request:", { email, action });

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
    let otpAction = action;
    if (action === "register_and_login") {
      const existingUser = await prismaDB.User.findUnique({ where: { email } });
      otpAction = existingUser ? "login" : "register";
    }

    // Generate unique OTP
    let otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      specialChars: false,
      lowerCaseAlphabets: false,
    });

    let existingOTP = await prismaDB.OTP.findFirst({ where: { otp } });
    while (existingOTP) {
      otp = otpGenerator.generate(6, {
        upperCaseAlphabets: false,
        specialChars: false,
        lowerCaseAlphabets: false,
      });
      existingOTP = await prismaDB.OTP.findFirst({ where: { otp } });
    }

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
        action: otpAction,
        expiresAt,
      },
    });

    // Send OTP via email or mobile
    const otpSend = await sendOTPVerification({
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
    console.error("SendOTP error:", error);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      message: error.message || "Error sending OTP!",
    });
  }
};

/**
 * @desc Register or login user with email and OTP
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @return {Object} JSON response with success or error message
 * @route POST /api/v1/auth/register-and-login
 * @access Public
 */
export const registerAndLogin = async (req, res) => {
  try {
    const { email, otp, googleToken } = req.body;

    // ---------1. Continue with Google Flow----------------
    if (googleToken) {
      try {
        // Verify Google token
        const ticket = await googleClient.verifyIdToken({
          idToken: googleToken,
          audience: [
            process.env.MRSC_GOOGLE_ANDROID_CLIENT_ID,
            process.env.MRSC_GOOGLE_WEB_CLIENT_ID,
          ],
        });

        const payload = ticket.getPayload();

        const googleEmail = payload?.email;
        const googleName = payload?.name;
        console.log("googleNameand Email", googleEmail, googleName);
        if (!googleEmail || !googleName) {
          return actionFailedResponse({
            res,
            errorCode: responseFlags.BAD_REQUEST,
            msg: "Invalid Google token",
          });
        }

        // Check if user already exists
        let user = await prismaDB.User.findUnique({
          where: { email: googleEmail },
        });
        if (!user) {
          // Register new user
          user = await prismaDB.User.create({
            data: {
              email: googleEmail,
              name: googleName,
              role: roleType.USER,
              authProvider: AuthProvider.GOOGLE,
            },
          });
        }

        if (!user.is_active) {
          return actionFailedResponse({
            res,
            errorCode: responseFlags.UNAUTHORIZED,
            msg: "Account is inactive. Please contact admin.",
          });
        }

        // Generate token
        const tokenPayload = {
          _id: user.id,
          email: user.email,
          role: user.role,
        };

        const token = generateAccessToken(tokenPayload, "30d");
        const { password, ...userWithoutPassword } = user;

        const msg = "Logged in with Google successfully.";
        return actionCompleteResponse({
          res,
          msg,
          data: { token, user: userWithoutPassword },
        });
      } catch (err) {
        return actionFailedResponse({
          res,
          errorCode: responseFlags.BAD_REQUEST,
          msg: err.message || "Google authentication failed",
        });
      }
    }

    // -------------2. OTP Based Flow-----------------------
    // 1. Validate input
    if (!email || !otp) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.PARAMETER_MISSING,
        msg: responseMessages.PARAMETER_MISSING,
      });
    }

    // 2. Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: responseMessages.BAD_REQUEST,
      });
    }

    // 3. Check if user exists
    let user = await prismaDB.User.findUnique({ where: { email } });
    const action = user ? "login" : "register";

    // 4. Get the latest OTP for the action
    const recentOtp = await prismaDB.OTP.findFirst({
      where: { email, action },
      orderBy: { createdAt: "desc" },
    });

    if (!recentOtp) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.NOT_FOUND,
        msg: responseMessages.NOT_FOUND,
      });
    }

    // 5. Check OTP expiry
    if (recentOtp.expiresAt < new Date()) {
      await prismaDB.OTP.delete({ where: { id: recentOtp.id } });
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: responseMessages.AUTHENTICATION_FAILED,
      });
    }

    // 6. Check OTP match
    if (recentOtp.otp !== otp) {
      await prismaDB.OTP.delete({ where: { id: recentOtp.id } });
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: responseMessages.INVALID_DATA,
      });
    }

    // 7. Clean up OTP
    await prismaDB.OTP.delete({ where: { id: recentOtp.id } });

    // 8. Register user if not already registered
    if (!user) {
      user = await prismaDB.User.create({
        data: {
          email,
          role: roleType.USER,
          authProvider: AuthProvider.OTP,
        },
      });

      await prismaDB.UserOTPVerification.create({
        data: {
          otp,
          expiresAt: new Date(),
          emailVerified: true,
          user: { connect: { email } },
        },
      });
    }

    // 9. Check if user is active
    if (!user.is_active) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.UNAUTHORIZED,
        msg: "Account is inactive. Please contact admin.",
      });
    }

    // 10. Generate token
    const tokenPayload = {
      _id: user.id,
      email: user.email,
      role: user.role,
    };

    const token = generateAccessToken(tokenPayload, "30d");
    const { password, ...userWithoutPassword } = user;

    // 11. Return success response
    return actionCompleteResponse({
      res,
      msg: `${
        action === "register" ? "Registered" : "Logged in"
      } successfully.`,
      data: {
        token,
        user: userWithoutPassword,
      },
    });
  } catch (error) {
    console.error("Error in authWithEmail:", error);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      msg: error.message || "Internal Server Error during auth.",
    });
  }
};