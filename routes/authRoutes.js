import express from "express";
import {
  employeeRegister,
  employerRegister,
  login,
  sendOTP,
} from "../controllers/authController.js";
import validate from "../middleware/validate.js";
import { userJwtToken } from "../middleware/userJwt.js";
import { registerAndLoginValidator, sendOTPValidator } from "../validator/authValidator.js";
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
  // validate({ body: registerAndLoginValidator }),
  login
);

//EMPLOYEE ROUTES
authRoutes.post(
  "/employee/register",
  upload.array("files", 1),
  // validate({ body: registerAndLoginValidator }),
  employeeRegister
);

// EMPLOYER ROUTES
authRoutes.post(
  "/employer/register",
  // validate({ body: registerAndLoginValidator }),
  employerRegister
);

export default authRoutes;
