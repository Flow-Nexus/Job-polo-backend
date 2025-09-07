import Joi from "joi";

export const sendOTPValidator = Joi.object({
  email: Joi.string().email().required(),
  action: Joi.string()
    .valid(...availableActionType)
    .required(),
});