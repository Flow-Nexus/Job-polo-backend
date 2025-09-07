import Joi from "joi";
import { availableActionType } from "../config/config.js";

export const sendOTPValidator = Joi.object({
  email: Joi.string().email().required(),
  action: Joi.string()
    .valid(...availableActionType)
    .required(),
});

export const registerAndLoginValidator = Joi.object({
  email: Joi.string().email().optional(),
  // role: Joi.string().valid("USER", "ADMIN", "OPERATOR").required(),
  otp: Joi.string().length(6).optional(),
  googleToken: Joi.string().optional(),
}).options({ stripUnknown: true });
