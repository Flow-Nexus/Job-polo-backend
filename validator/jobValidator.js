import Joi from "joi";
import {
  availableApplicationStatus,
  availableEmploymentType,
  availableJobMode,
  availableSalaryType,
  availableSaveViewActivityType,
  availableSaveViewType,
  availableShiftType,
  availableShortedBy,
} from "../config/config.js";

export const postJobValidator = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().required(),
  requirements: Joi.string().allow(""),
  responsibilities: Joi.string().allow(""),
  education: Joi.string().allow(""),

  // ------------------- NEW FIELDS -------------------

  minExperience: Joi.number().integer().min(0).optional(),
  maxExperience: Joi.number()
    .integer()
    .min(Joi.ref("minExperience"))
    .optional(),
  salaryType: Joi.string()
    .valid(...availableSalaryType)
    .optional(),
  minSalary: Joi.number().integer().min(0).optional(),
  maxSalary: Joi.number().integer().min(Joi.ref("minSalary")).optional(),
  shiftType: Joi.alternatives()
    .try(
      Joi.array().items(Joi.string().valid(...availableShiftType)),
      Joi.string() // allow stringified JSON
    )
    .optional(),
  questionnaire: Joi.alternatives()
    .try(
      Joi.object({
        skills: Joi.array().items(Joi.string()).max(5).optional(),
        willingToRelocate: Joi.boolean().optional(),
        expectedCTC: Joi.string().optional(),
        noticePeriod: Joi.string().optional(),
        dob: Joi.string().optional(),
      })
        .unknown(true) // allow dynamic Q selections
        .optional(),
      Joi.string() // allow JSON string from frontend
    )
    .optional(),

  // experienceRange: Joi.string().allow(""),
  // salaryRange: Joi.string().allow(""),
  companyName: Joi.string().allow("").required(),
  companyEmail: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      "string.empty": "companyEmail is required",
      "string.email": "Invalid email format",
    }),
  mode: Joi.string()
    .valid(...availableJobMode)
    .optional(),
  employmentType: Joi.string()
    .valid(...availableEmploymentType)
    .optional(),
  addresses: Joi.alternatives()
    .try(Joi.array().items(Joi.object()), Joi.string())
    .required(),
  skillsRequired: Joi.alternatives()
    .try(Joi.array().items(Joi.string()), Joi.string())
    .optional(),
  openings: Joi.number().integer().min(1).required(),
  deadline: Joi.date().optional(),
  categoryId: Joi.string().required().uuid(),
});

export const updateJobValidator = Joi.object({
  title: Joi.string().optional(),
  description: Joi.string().optional(),
  requirements: Joi.string().optional(),
  responsibilities: Joi.string().optional(),
  education: Joi.string().optional(),
  // NEW FIELDS
  minExperience: Joi.number().integer().min(0).optional(),
  maxExperience: Joi.number()
    .integer()
    .min(Joi.ref("minExperience"))
    .optional(),
  salaryType: Joi.string()
    .valid(...availableSalaryType)
    .optional(),
  minSalary: Joi.number().integer().min(0).optional(),
  maxSalary: Joi.number().integer().min(Joi.ref("minSalary")).optional(),
  shiftType: Joi.alternatives()
    .try(
      Joi.array().items(Joi.string().valid(...availableShiftType)),
      Joi.string()
    )
    .optional(),
  questionnaire: Joi.alternatives()
    .try(Joi.object().unknown(true), Joi.string())
    .optional(),
  companyName: Joi.string().required().allow(""),
  companyEmail: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      "string.empty": "companyEmail is required",
      "string.email": "Invalid email format",
    }),
  mode: Joi.string()
    .valid(...availableJobMode)
    .optional(),
  employmentType: Joi.string()
    .valid(...availableEmploymentType)
    .optional(),
  skillsRequired: Joi.alternatives()
    .try(Joi.array().items(Joi.string()), Joi.string())
    .optional(),
  openings: Joi.number().integer().optional(),
  addresses: Joi.alternatives()
    .try(Joi.array().items(Joi.object()), Joi.string())
    .optional(),
  deadline: Joi.date().optional(),
  categoryId: Joi.string().optional().uuid(),
  isActive: Joi.boolean().optional(),
});

export const getJobsWithValidator = Joi.object({
  search: Joi.string().optional(),
  mode: Joi.string().optional(),
  employmentType: Joi.string().optional(),
  city: Joi.string().optional(),
  state: Joi.string().optional(),
  country: Joi.string().optional(),
  pincode: Joi.number().optional(),
  userId: Joi.string().optional(),
  is_active: Joi.boolean().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

export const deleteJobValidator = Joi.object({
  jobId: Joi.string().required(),
});

export const applyForJobValidator = Joi.object({
  jobId: Joi.string().required().messages({
    "any.required": "Job ID is required",
    "string.empty": "Job ID cannot be empty",
  }),
  howFitRole: Joi.string().optional().allow(null, "").messages({
    "string.base": "How fit role must be a string",
  }),
  questionnaireAnswers: Joi.alternatives()
    .try(Joi.object().unknown(true), Joi.string())
    .optional()
    .messages({
      "string.base": "questionnaireAnswers must be JSON string",
      "object.base": "questionnaireAnswers must be an object",
    }),
});

export const withdrawJobApplicationValidator = Joi.object({
  query: Joi.object({
    applicationId: Joi.string().uuid().required().messages({
      "any.required": "Application ID is required",
      "string.empty": "Application ID cannot be empty",
      "string.guid": "Application ID must be a valid UUID",
    }),
    reason: Joi.string().optional().allow(null, "").messages({
      "string.base": "Reason must be a string",
    }),
  }),
});

export const updateJobApplicationStatusValidator = Joi.object({
  applicationId: Joi.string().required().messages({
    "any.required": "Application ID is required",
    "string.empty": "Application ID cannot be empty",
  }),
  newStatus: Joi.string()
    .valid(...availableApplicationStatus)
    .optional(),
  reason: Joi.string().optional().allow(null, "").messages({
    "string.base": "Reason must be a string",
  }),
  jobId: Joi.string().optional().allow(),
});

export const getJobApplicationsValidator = Joi.object({
  jobId: Joi.string().uuid().optional().messages({
    "string.uuid": "Job ID must be a valid UUID",
  }),
  employeeId: Joi.string().uuid().optional().messages({
    "string.uuid": "Employee ID must be a valid UUID",
  }),
  status: Joi.string()
    .valid(...availableApplicationStatus)
    .optional()
    .messages({
      "any.only": `Invalid status. Must be one of: ${availableApplicationStatus.join(
        ", "
      )}`,
    }),
  appliedBy: Joi.string().optional(),
  startDate: Joi.date().iso().optional().messages({
    "date.format": "Start date must be in ISO format (YYYY-MM-DD)",
  }),
  endDate: Joi.date().iso().optional().messages({
    "date.format": "End date must be in ISO format (YYYY-MM-DD)",
  }),
  search: Joi.string().optional().allow(""),
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  sortBy: Joi.string().optional().default("createdAt"),
  order: Joi.string().valid("asc", "desc").optional().default("desc"),
  employerId: Joi.string().uuid().optional(),
  categoryId: Joi.string().uuid().optional(),
});

export const savedDetailsValidator = Joi.object({
  type: Joi.string()
    .valid(...availableSaveViewType)
    .required(),
  id: Joi.string().uuid().required(),
});

export const viewedDetailsValidator = Joi.object({
  type: Joi.string()
    .valid(...availableSaveViewType)
    .required(),
  id: Joi.string().uuid().required(),
});

export const getSaveAndViewdActivityValidator = Joi.object({
  activityType: Joi.string()
    .valid(...availableSaveViewActivityType)
    .messages({
      "any.only": "activityType must be SAVED, VIEWED, or BOTH",
    }),
  type: Joi.string()
    .valid(
      ...availableSaveViewType,
      ...availableSaveViewType.map((v) => v.toLowerCase())
    )
    .optional()
    .messages({
      "any.only": `type must be one of: ${availableSaveViewType.join(", ")}`,
    }),
  is_active: Joi.boolean().optional(),
  startDate: Joi.date().iso().optional().messages({
    "date.format": "startDate must be a valid ISO date",
  }),
  endDate: Joi.date().iso().optional().messages({
    "date.format": "endDate must be a valid ISO date",
  }),
  search: Joi.string().allow("").optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(10),
  sort: Joi.string()
    .valid(...availableShortedBy)
    .default("newest")
    .messages({
      "any.only": "sort must be newest or oldest",
    }),
});
