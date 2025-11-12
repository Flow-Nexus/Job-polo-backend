import express from "express";
import {
  employeeRegister,
  employerRegister,
  forgotPassword,
  getUserByID,
  getUsersWithFilters,
  login,
  resetPassword,
  sendOTP,
  superAdminRegister,
} from "../controllers/authController.js";
import validate from "../middleware/validate.js";
import { employeeJwtToken } from "../middleware/employeeJwt.js";
import { employerJwtToken } from "../middleware/employerJwt.js";
import {
  employeeRegisterValidator,
  employerRegisterValidator,
  forgotPasswordValidator,
  getUsersWithValidator,
  getUserWithIdValidator,
  loginValidator,
  resetPasswordValidator,
  sendOTPValidator,
  superAdminRegisterValidator,
} from "../validator/authValidator.js";
import { upload } from "../cloud/cloudinaryCloudStorage.js";
import { superAdminJwtToken } from "../middleware/superAdminJwt.js";

const authRoutes = express.Router();

//COMMON ROUTES
authRoutes.post(
  "/employee/send-otp",
  validate({ query: sendOTPValidator }),
  sendOTP
);
authRoutes.post("/employee/login", validate({ body: loginValidator }), login);
authRoutes.post(
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
authRoutes.get(
  "/employee/get-user-profile/:userId",
  validate({ body: getUserWithIdValidator }),
  getUserByID
);

//EMPLOYEE ROUTES
authRoutes.post(
  "/employee/register",
  upload.fields([
    { name: "resumeFiles", maxCount: 2 },
    { name: "workSampleFiles", maxCount: 3 },
  ]),
  (req, res, next) => {
    console.log("Multer received files:", Object.keys(req.files || {}));
    next();
  },
  validate({ body: employeeRegisterValidator }),
  employeeRegister
);

authRoutes.get(
  "/employee/get-users-with",
  validate({ body: getUsersWithValidator }),
  employeeJwtToken,
  getUsersWithFilters
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
authRoutes.post(
  "/super-admin/register",
  upload.fields([{ name: "portfolioFiles", maxCount: 2 }]),
  // upload.array("portfolioFiles", 1),
  validate({ body: superAdminRegisterValidator }),
  superAdminJwtToken,
  superAdminRegister
);

export default authRoutes;
