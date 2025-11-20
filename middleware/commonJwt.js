import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { actionFailedResponse } from "../config/common.js";
import prismaDB from "../utlis/prisma.js";
import { responseFlags, roleType } from "../config/config.js";

dotenv.config();

export const commonJwtToken = async (req, res, next) => {
  const token = req.headers["x-access-token"];

  try {
    if (!token) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.UNAUTHORIZED,
        msg: "Permission denied. Token is missing.",
      });
    }

    // Decode and verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded._id || decoded.email;
    // console.log("Decoded Token:", decoded);

    if (!userId) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.UNAUTHORIZED,
        msg: "Invalid token.",
      });
    }

    // Fetch user with both relations (Employer + SuperAdmin + Admin + Employee)
    const user = await prismaDB.User.findUnique({
      where: { id: userId },
      include: {
        employer: true,
        superAdmin: true,
        employee: true,
        admin: true,
      },
    });
    if (!user) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.NOT_FOUND,
        msg: "User not found.",
      });
    }

    // Check account active
    if (!user.is_active) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.UNAUTHORIZED,
        msg: "Unauthorized user. Please contact admin.",
      });
    }

    // Allow All roles [EMPLOYER, SUPERADMIN, EMPLOYEE, ADMIN]
    if (user.role === roleType.EMPLOYER && user.employer) {
      req.employer_obj_id = user.id;
      req.employerDetails = `${user.firstName} ${user.lastName} - ${user.role}`;
      console.log("Employer Obj Id authenticated", req.employer_obj_id);
      console.log("Employer Name authenticated", req.employerDetails);
    } else if (user.role === roleType.SUPER_ADMIN && user.superAdmin) {
      req.superAdmin_obj_id = user.id;
      req.superAdminDetails = `${user.firstName} ${user.lastName} - ${user.role}`;
      console.log("SuperAdmin obj id authenticated", req.superAdmin_obj_id);
      console.log("SuperAdmin Name authenticated", req.superAdminDetails);
    } else if (user.role === roleType.EMPLOYEE && user.employee) {
      req.employee_obj_id = user.id;
      req.employeeDetails = `${user.firstName} ${user.lastName} - ${user.role}`;
      console.log("Employee obj id authenticated", req.employee_obj_id);
      console.log("Employee Name authenticated", req.employeeDetails);
    } else if (user.role === roleType.ADMIN && user.admin) {
      req.admin_obj_id = user.id;
      req.adminDetails = `${user.firstName} ${user.lastName} - ${user.role}`;
      console.log("Admin obj id authenticated", req.admin_obj_id);
      console.log("Admin Name authenticated", req.adminDetails);
    } else {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.UNAUTHORIZED,
        msg: "Unauthorized. Only Employer or SuperAdmin can access.",
      });
    }

    // Continue to controller
    return next();
  } catch (err) {
    console.error(err.message || "Common Token Error");
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      msg: err.message || "Token validation failed.",
    });
  }
};
