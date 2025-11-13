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

//for user gender
export const UserGender = {
  MALE: "MALE",
  FEMALE: "FEMALE",
  OTHER: "OTHER",
};
export const availableUserGender = [
  UserGender.MALE,
  UserGender.FEMALE,
  UserGender.OTHER,
];

//for user role
export const actionType = {
  LOGIN: "LOGIN",
  EMPLOYEE_REGISTER: "EMPLOYEE-REGISTER",
  EMPLOYER_REGISTER: "EMPLOYER-REGISTER",
  SUPER_ADMIN_REGISTER: "SUPER-ADMIN-REGISTER",
  SETPASSWORD: "RESET-PASSWORD",
  FORGOTPASSWORD: "FORGOT-PASSWORD",
  JOBPOST: "JOB-POST",
  UPDATEJOBPOST: "UPDATE-JOB-POST",
};
export const availableActionType = [
  actionType.LOGIN,
  actionType.EMPLOYEE_REGISTER,
  actionType.EMPLOYER_REGISTER,
  actionType.SUPER_ADMIN_REGISTER,
  actionType.SETPASSWORD,
  actionType.FORGOTPASSWORD,
  actionType.JOBPOST,
  actionType.UPDATEJOBPOST,
];

//for user role
export const roleType = {
  EMPLOYEE: "EMPLOYEE",
  EMPLOYER: "EMPLOYER",
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
};
export const availableRole = [
  roleType.EMPLOYEE,
  roleType.EMPLOYER,
  roleType.SUPER_ADMIN,
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

//for cloud storage
export const uploadFolderName = {
  EMPLOYEE_RESUME: "EMPLOYEE_RESUME",
  EMPLOYEE_WORK_SAMPLE: "EMPLOYEE_WORK_SAMPLE",
  EMPLOYEE_IMAGE: "EMPLOYEE_IMAGE",
  SUPER_ADMIN_PORTFOLIO: "SUPER_ADMIN_PORTFOLIO",
  JOB_POST_LOGO: "JOB_POST_LOGO",
  JOB_UPDATE_LOGO: "JOB_UPDATE_LOGO",
  CATEGORY_LOGO: "CATEGORY_LOGO",
};
export const availableUploadFolderName = [
  uploadFolderName.EMPLOYEE_RESUME,
  uploadFolderName.EMPLOYEE_WORK_SAMPLE,
  uploadFolderName.EMPLOYEE_IMAGE,
  uploadFolderName.SUPER_ADMIN_PORTFOLIO,
  uploadFolderName.JOB_POST_LOGO,
  uploadFolderName.CATEGORY_LOGO,
];

//for Job Mode
export const jobMode = {
  HYBRID: "HYBRID",
  ON_SITE: "ON_SITE",
  REMOTE: "REMOTE",
};
export const availableJobMode = [
  jobMode.HYBRID,
  jobMode.ON_SITE,
  jobMode.REMOTE,
];

//for Employment Type
export const EmploymentType = {
  FULL_TIME: "FULL_TIME",
  PART_TIME: "PART_TIME",
  CONTRACT: "CONTRACT",
  INTERNSHIP: "INTERNSHIP",
  FREELANCE: "FREELANCE",
};
export const availableEmploymentType = [
  EmploymentType.FULL_TIME,
  EmploymentType.PART_TIME,
  EmploymentType.CONTRACT,
  EmploymentType.INTERNSHIP,
  EmploymentType.FREELANCE,
];

//for Application Status
export const ApplicationStatus = {
  PENDING: "PENDING",
  APPLIED: "APPLIED",
  WITHDRAW: "WITHDRAW",
  RE_APPLIED: "RE_APPLIED",
  REJECTED: "REJECTED",
  RESUMEVIEWED: "RESUME_VIEWED",
  WAITINGEMPLOYERACTION: "WAITING_EMPLOYER_ACTION",
  APPLICATIONSEND: "APPLICATION_SEND",
  CONTACTVIEW: "CONTACT_VIEW",
  SELECTED: "SELECTED",
};
export const availableApplicationStatus = [
  ApplicationStatus.PENDING,
  ApplicationStatus.APPLIED,
  ApplicationStatus.WITHDRAW,
  ApplicationStatus.RE_APPLIED,
  ApplicationStatus.REJECTED,
  ApplicationStatus.RESUMEVIEWED,
  ApplicationStatus.WAITINGEMPLOYERACTION,
  ApplicationStatus.APPLICATIONSEND,
  ApplicationStatus.CONTACTVIEW,
  ApplicationStatus.SELECTED,
];
