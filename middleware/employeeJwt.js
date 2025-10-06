import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { actionFailedResponse } from "../config/common.js";
import { responseFlags, roleType } from "../config/config.js";
import prismaDB from "../utlis/prisma.js";

dotenv.config();

export const employeeJwtToken = async (req, res, next) => {
  const token = req.headers["x-access-token"];

  try {
    if (!token) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.UNAUTHORIZED,
        msg: "Permission denied. Token is missing.",
      });
    }

    // Decode and verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const employeeId = decoded._id;

    if (!employeeId) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.UNAUTHORIZED,
        msg: "Invalid token.",
      });
    }

    const employee = await prismaDB.User.findUnique({
      where: { id: employeeId },
    });
    if (!employee) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.NOT_FOUND,
        msg: "User not found.",
      });
    }

    // Validate allowed roles
    const allowedRoles = [
      roleType.EMPLOYEE,
      roleType.SUPERADMIN,
    ];
    if (!allowedRoles.includes(employee.role)) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.UNAUTHORIZED,
        msg: "Unauthorized. Access denied for this role.",
      });
    }

    if (!employee.is_active) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.UNAUTHORIZED,
        msg: "Unauthorized employee. Please contact admin.",
      });
    }

    // Attach employee info to request
    req.employee_obj_id = employee.id;
    req.employeeDetails = `${employee.firstName} ${employee.lastName} - ${employee.role}`;
    console.log("objeid", req.employee_obj_id);
    console.log("objeiddeaiial", req.employeeDetails);

    return next();
  } catch (err) {
    console.error("Employee Token Error:", err.message);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      msg: err.message || "Token validation failed.",
    });
  }
};
