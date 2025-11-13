import Joi from "joi";

export const addCategoryValidator = Joi.object({
  name: Joi.string()
    .custom((value, helper) => {
      // Convert to UPPERCASE but keep spaces
      const upper = value.toUpperCase();
      // Allow only capital letters + spaces
      if (!/^[A-Z ]+$/.test(upper)) {
        return helper.message(
          "Category name must contain only capital letters A-Z and spaces."
        );
      }
      return upper;
    })
    .required(),
  description: Joi.string().required(),
});

export const deleteCategoryValidator = Joi.object({
  categoryId: Joi.string().uuid().required(),
});

export const updateCategoryValidator = Joi.object({
  categoryId: Joi.string().required().messages({
    "any.required": "Category ID is required.",
    "string.empty": "Category ID cannot be empty.",
  }),
  name: Joi.string()
    .custom((value, helper) => {
      // Convert to UPPERCASE but keep spaces
      const upper = value.toUpperCase();
      // Allow only capital letters + spaces
      if (!/^[A-Z ]+$/.test(upper)) {
        return helper.message(
          "Category name must contain only capital letters A-Z and spaces."
        );
      }
      return upper;
    })
    .optional(),
  description: Joi.string().optional(),
  is_active: Joi.boolean().optional(),
}).unknown(false);
