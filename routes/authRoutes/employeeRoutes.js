import express from "express";
import {
  registerAndLogin,
  sendOTP,
} from "../../controllers/appController/userController/authController.js";
// import validate from "../../middleware/validate.js";
// import {
//   registerAndLoginValidator,
//   sendOTPValidator,
// } from "../../validator/appValidator/allUserValidator.js";
import { userJwtToken } from "../../middleware/userJwt.js";


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
