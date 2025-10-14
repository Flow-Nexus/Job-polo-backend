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
    const userId = decoded._id || decoded.email;
    // console.log("Decoded Token:", decoded);

    if (!userId) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.UNAUTHORIZED,
        msg: "Invalid token.",
      });
    }

    const user = await prismaDB.User.findUnique({
      where: { id: userId },
      include: { employee: true, superAdmin: true },
    });

    if (!user) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.NOT_FOUND,
        msg: "User not found.",
      });
    }

    if (!user.is_active) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.UNAUTHORIZED,
        msg: "Unauthorized employee. Please contact admin.",
      });
    }

    // Allow both Employee and SuperAdmin roles
    if (user.role === roleType.EMPLOYEE && user.employee) {
      req.employee_obj_id = user.id;
      req.employeeDetails = `${user.firstName} ${user.lastName} - ${user.role}`;
      console.log("Employee Obj Id authenticated", req.employee_obj_id);
      console.log("Employee Name authenticated", req.employeeDetails);
    } else if (user.role === roleType.SUPER_ADMIN && user.superAdmin) {
      req.superAdmin_obj_id = user.id;
      req.superAdminDetails = `${user.firstName} ${user.lastName} - ${user.role}`;
      console.log("SuperAdmin obj id authenticated", req.superAdmin_obj_id);
      console.log("SuperAdmin Name authenticated", req.superAdminDetails);
    } else {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.UNAUTHORIZED,
        msg: "Unauthorized. Only Employee or SuperAdmin can access.",
      });
    }

    // Continue to controller
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
