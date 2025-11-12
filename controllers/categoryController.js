import { actionFailedResponse } from "../config/common.js";
import { responseFlags, responseMessages } from "../config/config.js";
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
    const createdBy = req.superAdmin_obj_id;
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
    name = name.replace(/\s+/g, "").toUpperCase();

    // 3. Validate: only A–Z letters allowed
    if (!/^[A-Z]+$/.test(name)) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "Category name must contain only capital letters A-Z (no numbers, symbols, or spaces).",
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
        uploadFolderName.JOB_POST_LOGO,
        useremail
      );
      categoryUrls = categoryResults.categoryUrls?.[0] || null;
      categoryPreviewUrls = categoryResults.categoryPreviewUrls?.[0] || null;
    }

    // 5. Save category type
    const category = await prismaDB.Category.create({
      data: {
        name,
        description,
        isActive: true,
        createdBy,
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
      data: { categories },
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
export const updateCategoryType = async (req, res) => {
  try {
    const { id } = req.params;
    let { name, description, isActive } = req.body;
    const updatedBy = req.superAdmin_obj_id;

    if (!id) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.PARAMETER_MISSING,
        msg: responseMessages.PARAMETER_MISSING,
      });
    }

    const updateData = {};

    // Validate and format name
    if (name) {
      name = name.replace(/\s+/g, "").toUpperCase();
      if (!/^[A-Z]+$/.test(name)) {
        return actionFailedResponse({
          res,
          errorCode: responseFlags.BAD_REQUEST,
          msg: "Name must contain only capital letters A-Z.",
        });
      }
      updateData.name = name;
    }

    // Boolean conversion
    if (isActive !== undefined) {
      if (typeof isActive === "string") {
        isActive = isActive.toLowerCase() === "true";
      }
      updateData.isActive = Boolean(isActive);
    }

    // Handle image update using helper
    if (req.files && Array.isArray(req.files) && req.files.length > 0 && name) {
      const folderName = uploadFolderName.CATEGORY_TYPE_IMAGE;
      const { imageUrlsArray, previewUrlsArray } = await processUploadedFiles(
        req.files,
        name,
        folderName
      );
      if (imageUrlsArray.length > 0) {
        updateData.imageUrls = imageUrlsArray[0];
      }
      if (previewUrlsArray.length > 0) {
        updateData.previewUrls = previewUrlsArray[0];
      }
    }

    // Track updater
    if (updatedBy) {
      updateData.updatedBy = updatedBy;
    }

    if (Object.keys(updateData).length === 0) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "At least one field (name, isActive, or image) is required.",
      });
    }

    const updated = await prismaDB.categoryType.update({
      where: { id },
      data: updateData,
    });

    const msg = "Category type updated successfully.";
    return actionCompleteResponse({
      res,
      msg,
      data: { updated },
    });
  } catch (error) {
    console.error("Error updating category type:", error);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      msg: error.message || "Failed to update category type.",
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
export const deleteCategoryType = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.PARAMETER_MISSING,
        msg: "Category ID is required.",
      });
    }

    const deleted = await prismaDB.CategoryType.delete({
      where: { id },
    });

    //also delete the image from cloudinary

    const msg = "Category deleted successfully.";
    return actionCompleteResponse({
      res,
      msg,
      data: { deleted },
    });
  } catch (error) {
    console.error("Error:", error);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      msg: error.message || "Failed to delete category.",
    });
  }
};
