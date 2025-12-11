import express from "express";
import validate from "../middleware/validate.js";
import { employeeJwtToken } from "../middleware/employeeJwt.js";
import { employerJwtToken } from "../middleware/employerJwt.js";
import { upload } from "../cloud/cloudinaryCloudStorage.js";
import { superAdminJwtToken } from "../middleware/superAdminJwt.js";
import {
  applyForJob,
  deleteJob,
  getActiveJobApplications,
  getAllJobApplications,
  getJobsWithFilter,
  getSaveAndViewActivity,
  postJob,
  savedDetails,
  updateJob,
  updateJobApplicationStatus,
  viewedDetails,
  withdrawJobApplication,
} from "../controllers/jobController.js";
import {
  applyForJobValidator,
  deleteJobValidator,
  getJobApplicationsValidator,
  getJobsWithValidator,
  getSaveAndViewdActivityValidator,
  postJobValidator,
  savedDetailsValidator,
  updateJobApplicationStatusValidator,
  updateJobValidator,
  viewedDetailsValidator,
  withdrawJobApplicationValidator,
} from "../validator/jobValidator.js";
import { commonJwtToken } from "../middleware/commonJwt.js";

const jobRoutes = express.Router();

// COMMON ROUTES
jobRoutes.post(
  "/common/saved-details/:type/:id",
  validate({ params: savedDetailsValidator }),
  commonJwtToken,
  savedDetails
);

jobRoutes.post(
  "/common/viewed-details/:type/:id",
  validate({ params: viewedDetailsValidator }),
  commonJwtToken,
  viewedDetails
);

jobRoutes.get(
  "/common/get-save-view-activity",
  validate({ body: getSaveAndViewdActivityValidator }),
  commonJwtToken,
  getSaveAndViewActivity
);

// EMPLOYEE ROUTES
jobRoutes.post(
  "/employee/apply-job",
  upload.fields([
    { name: "resumeFiles", maxCount: 1 },
    { name: "workSampleFiles", maxCount: 1 }
  ]),
  validate({ body: applyForJobValidator}),
  employeeJwtToken,
  applyForJob
);

jobRoutes.post(
  "/employee/withdraw-job-application",
  validate({ body: withdrawJobApplicationValidator }),
  employeeJwtToken,
  withdrawJobApplication
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

jobRoutes.post(
  "/employer/update-job-application-status",
  validate({ body: updateJobApplicationStatusValidator }),
  employerJwtToken,
  updateJobApplicationStatus
);

jobRoutes.get(
  "/employer/get-active-job-applications",
  validate({ body: getJobApplicationsValidator }),
  employerJwtToken,
  getActiveJobApplications
);

// SUPERADMIN ROUTES
jobRoutes.get(
  "/super-admin/get-all-job-applications",
  validate({ body: getJobApplicationsValidator }),
  superAdminJwtToken,
  getAllJobApplications
);

export default jobRoutes;

