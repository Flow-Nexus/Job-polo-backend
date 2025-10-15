import Joi from "joi";
import { availableEmploymentType, availableJobMode } from "../config/config.js";

export const postJobValidator = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().required(),
  requirements: Joi.string().allow(""),
  responsibilities: Joi.string().allow(""),
  education: Joi.string().allow(""),
  experienceRange: Joi.string().allow(""),
  salaryRange: Joi.string().allow(""),
  mode: Joi.string().valid(...availableJobMode).optional(),
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
  otp: Joi.string().length(6).required(),
});

export const updateJobValidator = Joi.object({
  otp: Joi.string().length(6).required(),
  title: Joi.string().optional(),
  description: Joi.string().optional(),
  requirements: Joi.string().optional(),
  responsibilities: Joi.string().optional(),
  education: Joi.string().optional(),
  experienceRange: Joi.string().optional(),
  salaryRange: Joi.string().optional(),
  mode: Joi.string().valid(...availableJobMode).optional(),
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
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

export const deleteJobValidator = Joi.object({
  jobId: Joi.string().required(),
});
