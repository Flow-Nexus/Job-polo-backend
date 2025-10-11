import express from "express";
import {
  getUsersWithFilters,
} from "../controllers/authController.js";
import validate from "../middleware/validate.js";
import { employeeJwtToken } from "../middleware/employeeJwt.js";
import { employerJwtToken } from "../middleware/employerJwt.js";
import {
  getUsersWithValidator,
} from "../validator/authValidator.js";
import { upload } from "../cloud/cloudinaryCloudStorage.js";
import { superAdminJwtToken } from "../middleware/superAdminJwt.js";
import { postJob } from "../controllers/jobController.js";

const authRoutes = express.Router();

//COMMON ROUTES


//EMPLOYEE ROUTES


// EMPLOYER ROUTES
authRoutes.get(
  "/employer/post-job",
  // validate({ body: getUsersWithValidator }),
  employerJwtToken,
  postJob
);

// SUPERADMIN ROUTES


export default authRoutes;
