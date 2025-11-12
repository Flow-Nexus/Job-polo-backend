import express from "express";
import validate from "../middleware/validate.js";
import { upload } from "../cloud/cloudinaryCloudStorage.js";
import { superAdminJwtToken } from "../middleware/superAdminJwt.js";
import {
  applyForJob,
} from "../controllers/jobController.js";
import { getCategory } from "../controllers/categoryController.js";
import { updateCategoryValidator } from "../validator/categoryValidator.js";

const categoryRoutes = express.Router();

// EMPLOYEE ROUTES
categoryRoutes.post(
  "/super-admin/add-category",
  upload.fields([
    { name: "categoryFile", maxCount: 1 },
  ]),
  // validate({ body: applyForJobValidator}),
  superAdminJwtToken,
  applyForJob
);

categoryRoutes.get(
  "/super-admin/get-category",
  // validate({ body: applyForJobValidator}),
  getCategory
);

categoryRoutes.put(
  "/super-admin/update-category",
   upload.fields([
    { name: "categoryFile", maxCount: 1 },
  ]),
  // validate({ body: updateCategoryValidator}),
  // superAdminJwtToken,
  getCategory
);
categoryRoutes.delete(
  "/super-admin/delete-category",
  // validate({ body: applyForJobValidator}),
  // superAdminJwtToken,
  getCategory
);


export default categoryRoutes;
