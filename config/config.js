//for response messages and flags
export const responseMessages = {
  PARAMETER_MISSING:
    "Insufficient information was supplied. Please check and try again.",
  ACTION_COMPLETE: "Successful",
  BAD_REQUEST: "Invalid Request",
  AUTHENTICATION_FAILED: "Authentication failed",
  ACTION_FAILED: "Something went wrong. Please try again.",
  INCORRECT_PASSWORD: "Incorrect Password",
  NOT_FOUND: "Data Not Found in Database.",
  ALLREADY_EXISTS: "This Data all ready Present.",
  INVALID_DATA: "Invalid Data Enter",
  CART_EMPTY: "Cart is empty",
  INVALID_OTP: "Invalid OTP",
  OTP_EXPIRED: "OTP Expired",
};
export const responseFlags = {
  PARAMETER_MISSING: 400,
  ACTION_COMPLETE: 200,
  ACTION_FAILED: 500,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNAUTHORIZED: 401,
  BAD_REQUEST: 400,
  FORBIDDEN: 403,
  CREATED: 201,
  NO_CONTENT: 204,
};

// JWT and Token details
export const tokenDetails = {
  TOKENSECRET: process.env.TOKENSECRET,
  JWT_SECRET: process.env.JWT_SECRET,
};

//for user role
export const actionType = {
  LOGIN: "login",
  REGISTER: "register",
  SETPASSWORD: "set_password",
  REGISTERANDLOGIN: "register_and_login",
  FORGOTPASSWORD: "forgot_password",
};
export const availableActionType = [
  actionType.LOGIN,
  actionType.REGISTER,
  actionType.SETPASSWORD,
  actionType.REGISTERANDLOGIN,
  actionType.FORGOTPASSWORD,
];

//for user role
export const roleType = {
  ADMIN: "ADMIN",
  USER: "USER",
  OPERATOR: "OPERATOR",
};
export const availableRole = [roleType.ADMIN, roleType.USER, roleType.OPERATOR];

//for login GOOGLE
export const AuthProvider = {
  OTP: "OTP",
  GOOGLE: "GOOGLE",
  ADMIN_CREATED: "ADMIN_CREATED",
};
export const availableAuthProvider = [
  roleType.OTP,
  roleType.GOOGLE,
  roleType.ADMIN_CREATED,
];