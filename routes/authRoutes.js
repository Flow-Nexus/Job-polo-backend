import express from "express";
import {
  completeUserProfile,
  employeeRegister,
  employerRegister,
  forgotPassword,
  getUserByID,
  getUsersWithFilters,
  login,
  resetPassword,
  sendOTP,
  superAdminOnboardUser,
} from "../controllers/authController.js";
import validate from "../middleware/validate.js";
import {
  employeeRegisterValidator,
  employerRegisterValidator,
  forgotPasswordValidator,
  getUsersWithValidator,
  getUserWithIdValidator,
  loginValidator,
  resetPasswordValidator,
  sendOTPValidator,
  superAdminOnboardUserValidator,
} from "../validator/authValidator.js";
import { upload } from "../cloud/cloudinaryCloudStorage.js";
import { superAdminJwtToken } from "../middleware/superAdminJwt.js";
import { commonJwtToken } from "../middleware/commonJwt.js";

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
  commonJwtToken,
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
  commonJwtToken,
  getUserByID
);
authRoutes.put(
  "/employee/complete-user-profile/:userId",
  // validate({ body: getUserWithIdValidator }),
  commonJwtToken,
  completeUserProfile
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
  "/super-admin/get-users-with",
  validate({ body: getUsersWithValidator }),
  superAdminJwtToken,
  getUsersWithFilters
);

// EMPLOYER ROUTES
authRoutes.post(
  "/employer/register",
  upload.none(),
  validate({ body: employerRegisterValidator }),
  employerRegister
);

// SUPERADMIN ROUTES
authRoutes.post(
  "/super-admin/on-bording",
  validate({ body: superAdminOnboardUserValidator }),
  superAdminJwtToken,
  superAdminOnboardUser
);

export default authRoutes;
