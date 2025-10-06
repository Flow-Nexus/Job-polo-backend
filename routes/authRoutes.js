import express from "express";
import {
  employeeRegister,
  employerRegister,
  forgotPassword,
  login,
  resetPassword,
  sendOTP,
} from "../controllers/authController.js";
import validate from "../middleware/validate.js";
import { employeeJwtToken } from "../middleware/employeeJwt.js";
import { employerJwtToken } from "../middleware/employerJwt.js";
import {
  employeeRegisterValidator,
  employerRegisterValidator,
  forgotPasswordValidator,
  loginValidator,
  resetPasswordValidator,
  sendOTPValidator,
} from "../validator/authValidator.js";
import { upload } from "../cloud/cloudStorage.js";

const authRoutes = express.Router();

//COMMON ROUTES
authRoutes.post(
  "/employee/send-otp",
  validate({ query: sendOTPValidator }),
  sendOTP
);
authRoutes.post(
  "/employee/login",
  validate({ body: loginValidator }),
  login
);
authRoutes.put(
  "/employee/reset-password",
  validate({ body: resetPasswordValidator }),
  employeeJwtToken,
  resetPassword
);
authRoutes.post(
  "/employee/forgot-password",
  validate({ body: forgotPasswordValidator }),
  forgotPassword
);

//EMPLOYEE ROUTES
authRoutes.post(
  "/employee/register",
  upload.array("files", 1),
  validate({ body: employeeRegisterValidator }),
  employeeRegister
);

// EMPLOYER ROUTES
authRoutes.post(
  "/employer/register",
  upload.none(),
  validate({ body: employerRegisterValidator }),
  // employerJwtToken,
  employerRegister
);

// SUPERADMIN ROUTES

export default authRoutes;
