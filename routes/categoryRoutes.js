import express from "express";
import validate from "../middleware/validate.js";
import { upload } from "../cloud/cloudinaryCloudStorage.js";
import { superAdminJwtToken } from "../middleware/superAdminJwt.js";
import {
  applyForJob,
} from "../controllers/jobController.js";
import { addCategory, deleteCategory, getCategory, updateCategory } from "../controllers/categoryController.js";
import { addCategoryValidator, deleteCategoryValidator, updateCategoryValidator } from "../validator/categoryValidator.js";

const categoryRoutes = express.Router();

// EMPLOYEE ROUTES
categoryRoutes.post(
  "/super-admin/add-category",
  upload.fields([
    { name: "categoryFile", maxCount: 1 },
  ]),
  validate({ body: addCategoryValidator}),
  superAdminJwtToken,
  addCategory
);

categoryRoutes.get(
  "/super-admin/get-category",
  // validate({ body: getCategoryValidator}),
  getCategory
);

categoryRoutes.put(
  "/super-admin/update-category",
   upload.fields([
    { name: "categoryFile", maxCount: 1 },
  ]),
  validate({ body: updateCategoryValidator}),
  superAdminJwtToken,
  updateCategory
);
categoryRoutes.delete(
  "/super-admin/delete-category/:categoryId",
  validate({ body: deleteCategoryValidator }),
  superAdminJwtToken,
  deleteCategory
);


export default categoryRoutes;
