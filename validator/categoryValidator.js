import Joi from "joi";

export const addCategoryValidator = Joi.object({
  name: Joi.string()
    .replace(/\s+/g, "")
    .uppercase()
    .pattern(/^[A-Z]+$/)
    .required()
    .messages({
      "string.pattern.base":
        "Category name must contain only capital letters A-Z.",
    }),
  description: Joi.string().required(),
});

export const deletecategoryValidator = Joi.object({
  id: Joi.string().uuid().required(),
});

export const updateCategoryValidator = Joi.object({
  name: Joi.string()
    .pattern(/^[A-Z\s]+$/)
    .optional(),
  description: Joi.string().optional(),
  isActive: Joi.boolean().optional(),
});
