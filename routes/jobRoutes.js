import express from "express";
import validate from "../middleware/validate.js";
import { employeeJwtToken } from "../middleware/employeeJwt.js";
import { employerJwtToken } from "../middleware/employerJwt.js";
import { upload } from "../cloud/cloudinaryCloudStorage.js";
import { superAdminJwtToken } from "../middleware/superAdminJwt.js";
import {
  deleteJob,
  getJobsWithFilter,
  postJob,
  updateJob,
} from "../controllers/jobController.js";
import {
  deleteJobValidator,
  getJobsWithValidator,
  postJobValidator,
  updateJobValidator,
} from "../validator/jobValidator.js";

const authRoutes = express.Router();

// COMMON ROUTES

// EMPLOYEE ROUTES

// EMPLOYER ROUTES
authRoutes.post(
  "/employer/post-job",
  upload.fields([{ name: "logoFiles", maxCount: 1 }]),
  validate({ body: postJobValidator }),
  employerJwtToken,
  postJob
);

authRoutes.put(
  "/employer/update-job/:jobId",
  upload.fields([{ name: "logoFiles", maxCount: 1 }]),
  validate({ body: updateJobValidator }),
  employerJwtToken,
  updateJob
);

authRoutes.get(
  "/employee/get-jobs-with",
  validate({ body: getJobsWithValidator }),
  getJobsWithFilter
);

authRoutes.delete(
  "/employer/delete-job/:jobId",
  validate({ body: deleteJobValidator }),
  employerJwtToken,
  deleteJob
);

// SUPERADMIN ROUTES

export default authRoutes;
