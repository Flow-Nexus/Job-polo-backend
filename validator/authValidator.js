import Joi from "joi";
import {
  availableActionType,
  availableRole,
  availableUserGender,
} from "../config/config.js";

export const sendOTPValidator = Joi.object({
  email: Joi.string().email().required(),
  action: Joi.string()
    .valid(...availableActionType)
    .required(),
});

export const employeeRegisterValidator = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      "string.empty": "Email is required",
      "string.email": "Invalid email format",
    }),
  firstName: Joi.string().min(2).max(50).required().messages({
    "string.empty": "First name is required",
    "string.min": "First name must be at least 2 characters",
  }),
  lastName: Joi.string().min(2).max(50).required().messages({
    "string.empty": "Last name is required",
    "string.min": "Last name must be at least 2 characters",
  }),
  countryCode: Joi.string().optional(),
  mobileNumber: Joi.string()
    .pattern(/^[0-9]{7,15}$/)
    .optional()
    .messages({
      "string.pattern.base": "Mobile number must be 7-15 digits",
    }),
  gender: Joi.string()
    .valid(...availableUserGender)
    .messages({
      "string.empty": "Gender is not valid",
    }),
  currentCtc: Joi.number().optional(),
  expectedCtc: Joi.number().optional(),
  industry: Joi.string().optional(),
  functionArea: Joi.string().optional(),
  city: Joi.string().optional(),
  state: Joi.string().optional(),
  country: Joi.string().optional(),
  pincode: Joi.string().optional(),
  password: Joi.string().min(6).optional().messages({
    "string.min": "Password must be at least 6 characters",
  }),
  confirmPassword: Joi.string().valid(Joi.ref("password")).optional().messages({
    "any.only": "Password and confirm password do not match",
  }),
  TCPolicy: Joi.boolean().required().messages({
    "any.required": "Terms and Conditions must be accepted",
  }),
  otp: Joi.string().length(6).required().messages({
    "string.empty": "OTP is required",
    "string.length": "OTP must be 6 digits",
  }),
});

export const employerRegisterValidator = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      "string.empty": "Email is required",
      "string.email": "Invalid email format",
    }),

  firstName: Joi.string().min(2).max(50).required().messages({
    "string.empty": "First name is required",
    "string.min": "First name must be at least 2 characters",
  }),

  lastName: Joi.string().min(2).max(50).required().messages({
    "string.empty": "Last name is required",
    "string.min": "Last name must be at least 2 characters",
  }),

  countryCode: Joi.string()
    .pattern(/^\+\d{1,4}$/)
    .optional()
    .messages({
      "string.pattern.base": "Country code must be like +91",
    }),

  mobileNumber: Joi.string()
    .pattern(/^[0-9]{7,15}$/)
    .optional()
    .messages({
      "string.pattern.base": "Mobile number must be 7-15 digits",
    }),

  companyName: Joi.string().min(2).max(100).required().messages({
    "string.empty": "Company name is required",
  }),

  industry: Joi.string().optional(),

  functionArea: Joi.string().optional(),

  city: Joi.string().optional(),

  state: Joi.string().optional(),

  country: Joi.string().optional(),

  pincode: Joi.string().optional(),

  password: Joi.string().min(6).optional().messages({
    "string.min": "Password must be at least 6 characters",
  }),

  confirmPassword: Joi.string().valid(Joi.ref("password")).optional().messages({
    "any.only": "Password and confirm password do not match",
  }),

  TCPolicy: Joi.boolean().required().messages({
    "any.required": "Terms and Conditions must be accepted",
  }),

  otp: Joi.string().length(6).required().messages({
    "string.empty": "OTP is required",
    "string.length": "OTP must be 6 digits",
  }),
});

export const loginValidator = Joi.object({
  email: Joi.string().email().when("googleToken", {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),

  password: Joi.string().min(6).when("googleToken", {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.optional(),
  }),

  otp: Joi.string()
    .length(6)
    .pattern(/^[A-Z0-9]+$/i)
    .when("googleToken", {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.optional(),
    }),

  googleToken: Joi.string().optional(),
})
  .or("googleToken", "password", "otp")
  .messages({
    "object.missing":
      "Provide valid credentials: (email+password), (email+otp), or (googleToken).",
  });

export const resetPasswordValidator = Joi.object({
  userId: Joi.string().optional(),
  otp: Joi.string().optional(),
  password: Joi.string().min(6).required().messages({
    "string.empty": "Password is required",
    "string.min": "Password must be at least 6 characters",
  }),
  confirmPassword: Joi.string().valid(Joi.ref("password")).required().messages({
    "any.only": "Password and Confirm Password do not match",
    "string.empty": "Confirm Password is required",
  }),
});

export const forgotPasswordValidator = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .optional()
    .messages({
      "string.empty": "Email is required",
      "string.email": "Invalid email format",
    }),
  otp: Joi.string().length(6).optional().messages({
    "string.empty": "OTP is required",
    "string.length": "OTP must be 6 digits",
  }),
  password: Joi.string().min(6).required().messages({
    "string.empty": "Password is required",
    "string.min": "Password must be at least 6 characters long",
  }),
  confirmPassword: Joi.any().valid(Joi.ref("password")).required().messages({
    "any.only": "Password and Confirm Password do not match",
    "any.required": "Confirm Password is required",
  }),
});

export const superAdminRegisterValidator = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      "string.empty": "Email is required",
      "string.email": "Invalid email format",
    }),
  firstName: Joi.string().min(2).max(50).required().messages({
    "string.empty": "First name is required",
    "string.min": "First name must be at least 2 characters",
  }),
  lastName: Joi.string().min(2).max(50).required().messages({
    "string.empty": "Last name is required",
    "string.min": "Last name must be at least 2 characters",
  }),
  countryCode: Joi.string().optional(),
  mobileNumber: Joi.string()
    .pattern(/^[0-9]{7,15}$/)
    .optional()
    .messages({
      "string.pattern.base": "Mobile number must be 7-15 digits",
    }),
  alternativeMobileNumber: Joi.string()
    .pattern(/^[0-9]{7,15}$/)
    .optional()
    .messages({
      "string.pattern.base": "Mobile number must be 7-15 digits",
    }),
  gender: Joi.string()
    .valid(...availableUserGender)
    .messages({
      "string.empty": "Gender is not valid",
    }),
  dob: Joi.string().optional(),
  linkedinUrl: Joi.string().optional(),
  city: Joi.string().optional(),
  state: Joi.string().optional(),
  country: Joi.string().optional(),
  pincode: Joi.string().optional(),
  password: Joi.string().min(6).optional().messages({
    "string.min": "Password must be at least 6 characters",
  }),
  confirmPassword: Joi.string().valid(Joi.ref("password")).optional().messages({
    "any.only": "Password and confirm password do not match",
  }),
  TCPolicy: Joi.boolean().required().messages({
    "any.required": "Terms and Conditions must be accepted",
  }),
  otp: Joi.string().length(6).required().messages({
    "string.empty": "OTP is required",
    "string.length": "OTP must be 6 digits",
  }),
});

export const getUsersWithValidator = Joi.object({
  userId: Joi.string().uuid().optional(),
  mobileNumber: Joi.string().optional(),
  role: Joi.string()
    .valid(...Object.values(availableRole))
    .optional(),
  is_active: Joi.boolean().optional(),
  experience: Joi.number().integer().min(0).optional(),
  industry: Joi.string().optional(),
  functionArea: Joi.string().optional(),
  search: Joi.string().optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});
