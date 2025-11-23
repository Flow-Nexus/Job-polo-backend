import {
  processUploadedFiles,
  updateFileHelper,
} from "../cloud/cloudHelper.js";
import {
  actionCompleteResponse,
  actionFailedResponse,
} from "../config/common.js";
import {
  responseFlags,
  responseMessages,
  uploadFolderName,
} from "../config/config.js";
import prismaDB from "../utlis/prisma.js";

/**
 * @desc ADD Category handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @return {Object} JSON response with success or error message
 * @route POST /api/v1/category/super-admin/add-category
 * @access SUPER ADMIN
 */
export const addCategory = async (req, res) => {
  try {
    let { name, description } = req.body;
    const userId = req.superAdminDetails || req.superAdmin_obj_id;
    const categoryFiles = req.files?.categoryFile || [];

    // 1. Check if name is provided
    if (!name || !description) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.PARAMETER_MISSING,
        msg: responseMessages.PARAMETER_MISSING,
      });
    }

    // 2.remove all spaces and convert to uppercase
    name = name?.toUpperCase();

    // 3. Validate: only A–Z letters and spaces allowed
    if (!/^[A-Z ]+$/.test(name)) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "Category name must contain only capital letters A-Z and spaces.",
      });
    }

    // 4. Check if it already exists
    const existing = await prismaDB.Category.findUnique({
      where: { name },
    });
    if (existing) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "This Category Already Added",
      });
    }

    // ---------- FILE UPLOAD ----------
    let categoryUrls = null;
    let categoryPreviewUrls = null;

    if (categoryFiles.length > 0) {
      const categoryResults = await processUploadedFiles(
        categoryFiles,
        uploadFolderName.CATEGORY_LOGO,
        name
      );
      categoryUrls = categoryResults.imageUrlsArray?.[0] || null;
      categoryPreviewUrls = categoryResults.previewUrlsArray?.[0] || null;
    }

    // 5. Save category type
    const category = await prismaDB.Category.create({
      data: {
        name,
        description,
        createdBy: userId,
        categoryUrls,
        categoryPreviewUrls,
      },
    });

    const msg = "Category Added successfully.";
    return actionCompleteResponse({
      res,
      msg,
      data: { category },
    });
  } catch (error) {
    console.error("Error adding category:", error);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      msg: error.message || "Failed to add category type.",
    });
  }
};

/**
 * @desc GET Category handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @return {Object} JSON response with success or error message
 * @route GET /api/v1/category/super-admin/get-category
 * @access Public
 */
export const getCategory = async (req, res) => {
  try {
    const { is_active, search } = req.query;

    const filters = {};
    if (is_active !== undefined) {
      filters.is_active = is_active === "true";
    }
    if (search) {
      filters.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const categories = await prismaDB.Category.findMany({
      where: filters,
      orderBy: { createdAt: "desc" },
    });

    const msg = "Categories fetched successfully";
    return actionCompleteResponse({
      res,
      msg,
      data: { categoryCount: categories.length, categories },
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      msg: error.message,
    });
  }
};

/**
 * @desc PUT Update Categort handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @return {Object} JSON response with success or error message
 * @route PUT /api/v1/category/super-admin/update-category
 * @access SUPER ADMIN
 */
export const updateCategory = async (req, res) => {
  try {
    let { categoryId, name, description, is_active } = req.body;
    const userId = req.superAdminDetails || req.superAdmin_obj_id;
    const categoryFiles = req.files?.categoryFile || [];

    // 1 Validate category ID
    if (!categoryId) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.PARAMETER_MISSING,
        msg: responseMessages.PARAMETER_MISSING,
      });
    }

    // 2 Check category exists
    const existingCategory = await prismaDB.Category.findUnique({
      where: { id: categoryId },
    });
    if (!existingCategory) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "Category not found.",
      });
    }

    // 3 Name validation if provided
    if (name) {
      name = name.toUpperCase();

      // 3. Validate: only A–Z letters and spaces allowed
      if (!/^[A-Z ]+$/.test(name)) {
        return actionFailedResponse({
          res,
          errorCode: responseFlags.BAD_REQUEST,
          msg: "Category name must contain only capital letters A-Z and spaces.",
        });
      }

      // Check if name already used by another category
      const nameExists = await prismaDB.Category.findFirst({
        where: {
          name,
          NOT: { id: categoryId },
        },
      });

      if (nameExists) {
        return actionFailedResponse({
          res,
          errorCode: responseFlags.BAD_REQUEST,
          msg: "This category name is already used.",
        });
      }
    }

    // 4 Update Image (universal helper)
    const { publicUrl, previewUrl } = await updateFileHelper(
      existingCategory.categoryUrls,
      categoryFiles,
      uploadFolderName.CATEGORY_LOGO,
      name || existingCategory.name
    );

    // 5 Update DB
    const updatedCategory = await prismaDB.Category.update({
      where: { id: categoryId },
      data: {
        name: name || existingCategory.name,
        is_active: is_active ?? existingCategory.is_active,
        description: description || existingCategory.description,
        updatedBy: userId,
        categoryUrls: publicUrl,
        categoryPreviewUrls: previewUrl,
      },
    });

    const msg = "Category updated successfully.";
    return actionCompleteResponse({
      res,
      msg,
      data: { category: updatedCategory },
    });
  } catch (error) {
    console.error("Error updating category:", error);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      msg: error.message || "Failed to update category.",
    });
  }
};

/**
 * @desc DELETE Delete Category handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @return {Object} JSON response with success or error message
 * @route DELETE /api/v1/category/super-admin/delete-category
 * @access SUPER ADMIN
 */
export const deleteCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    if (!categoryId) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.PARAMETER_MISSING,
        msg: responseMessages.PARAMETER_MISSING,
      });
    }

    // Find category
    const category = await prismaDB.Category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "Category not found.",
      });
    }

    // Delete image using helper
    await updateFileHelper(
      category.categoryUrls,
      [],
      uploadFolderName.CATEGORY_LOGO,
      ""
    );

    // Delete category
    await prismaDB.Category.delete({
      where: { id: categoryId },
    });

    const msg = "Category deleted successfully.";
    return actionCompleteResponse({
      res,
      msg,
      data: {},
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      msg: error.message || "Failed to delete category.",
    });
  }
};
