import Joi from "joi";
import { actionFailedResponse } from "../config/common.js";
import pick from "../utlis/helper/pick.js";
import { responseFlags } from "../config/config.js";

const validate = (schema) => (req, res, next) => {
  const validSchema = pick(schema, ["params", "query", "body"]);
  const requestData = pick(req, Object.keys(validSchema));

  const { value, error } = Joi.compile(validSchema)
    .prefs({ errors: { label: "key" }, abortEarly: false })
    .validate(requestData);

  if (error) {
    const errorMessage = error.details
      ?.map((detail) => detail.message)
      .join(", ");
    console.log("Validation Error:", errorMessage);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.BAD_REQUEST,
      msg: errorMessage,
    });
  }

  Object.assign(req, value);
  return next();
};

export default validate;
