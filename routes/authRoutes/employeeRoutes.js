import express from "express";
import {
  registerAndLogin,
  sendOTP,
} from "../../controller/authController/employeeController.js";
import validate from "../../middleware/validate.js";
import { userJwtToken } from "../../middleware/userJwt.js";
import { registerAndLoginValidator, sendOTPValidator } from "../../validator/authValidator.js";


const employeeRouter = express.Router();

// Send OTP for user registration or login
employeeRouter.post(
  "/auth/send-otp",
  validate({ query: sendOTPValidator }),
  sendOTP
);
employeeRouter.post(
  "/auth/register-and-login",
  validate({ body: registerAndLoginValidator }),
  registerAndLogin
);

export default employeeRouter;
