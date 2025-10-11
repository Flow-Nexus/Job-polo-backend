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
    const employeeId = decoded._id || decoded.email;
    // console.log("Decoded Token:", decoded);

    if (!employeeId) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.UNAUTHORIZED,
        msg: "Invalid token.",
      });
    }

    const employee = await prismaDB.User.findUnique({
      where: { id: employeeId },
      include: { employee: true },
    });

    if (!employee) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.NOT_FOUND,
        msg: "User not found.",
      });
    }

    // Validate allowed roles
    const allowedRoles = [roleType.EMPLOYEE, roleType.SUPER_ADMIN];
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

    console.log("employee_obj_id", req.employee_obj_id);
    console.log("employeeDetails", req.employeeDetails);

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
