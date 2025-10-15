import express from "express";
import validate from "../middleware/validate.js";
import { employeeJwtToken } from "../middleware/employeeJwt.js";
import { employerJwtToken } from "../middleware/employerJwt.js";
import { upload } from "../cloud/cloudinaryCloudStorage.js";
import { superAdminJwtToken } from "../middleware/superAdminJwt.js";
import {
  applyForJob,
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

const jobRoutes = express.Router();

// COMMON ROUTES

// EMPLOYEE ROUTES
jobRoutes.post(
  "/employee/apply-job",
  upload.fields([{ name: "resumeFiles", maxCount: 1 }]),
  // validate({ body: postJobValidator }),
  employeeJwtToken,
  applyForJob
);

// EMPLOYER ROUTES
jobRoutes.post(
  "/employer/post-job",
  upload.fields([{ name: "logoFiles", maxCount: 1 }]),
  validate({ body: postJobValidator }),
  employerJwtToken,
  postJob
);

jobRoutes.put(
  "/employer/update-job/:jobId",
  upload.fields([{ name: "logoFiles", maxCount: 1 }]),
  validate({ body: updateJobValidator }),
  employerJwtToken,
  updateJob
);

jobRoutes.get(
  "/employee/get-jobs-with",
  validate({ body: getJobsWithValidator }),
  getJobsWithFilter
);

jobRoutes.delete(
  "/employer/delete-job/:jobId",
  validate({ body: deleteJobValidator }),
  employerJwtToken,
  deleteJob
);

// SUPERADMIN ROUTES

export default jobRoutes;
