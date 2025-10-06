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
  LOGIN: "LOGIN",
  EMPLOYEE_REGISTER: "EMPLOYEE-REGISTER",
  EMPLOYER_REGISTER: "EMPLOYER-REGISTER",
  SETPASSWORD: "RESET-PASSWORD",
  FORGOTPASSWORD: "FORGOT-PASSWORD",
};
export const availableActionType = [
  actionType.LOGIN,
  actionType.EMPLOYEE_REGISTER,
  actionType.EMPLOYER_REGISTER,
  actionType.SETPASSWORD,
  actionType.FORGOTPASSWORD,
];

//for user role
export const roleType = {
  EMPLOYEE: "EMPLOYEE",
  EMPLOYER: "EMPLOYER",
  SUPERADMIN: "SUPERADMIN",
  ADMIN: "ADMIN",
};
export const availableRole = [
  roleType.EMPLOYEE,
  roleType.EMPLOYER,
  roleType.SUPERADMIN,
  roleType.ADMIN,
];

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
