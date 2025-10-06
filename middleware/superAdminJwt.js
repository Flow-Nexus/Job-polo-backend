import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { actionFailedResponse } from "../config/common.js";
import { responseFlags, roleType } from "../config/config.js";
import prismaDB from "../utlis/prisma.js";

dotenv.config();

export const superAdminJwtToken = async (req, res, next) => {
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
    const superAdminId = decoded._id;

    if (!superAdminId) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.UNAUTHORIZED,
        msg: "Invalid token.",
      });
    }

    const superAdmin = await prismaDB.User.findUnique({
      where: { id: superAdminId },
    });
    if (!superAdmin) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.NOT_FOUND,
        msg: "User not found.",
      });
    }

    // Validate allowed roles
    const allowedRoles = [roleType.SUPERADMIN];
    if (!allowedRoles.includes(superAdmin.role)) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.UNAUTHORIZED,
        msg: "Unauthorized. Access denied for this role.",
      });
    }

    if (!superAdmin.is_active) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.UNAUTHORIZED,
        msg: "Unauthorized User. Please contact admin.",
      });
    }

    // Attach superAdmin info to request
    req.superAdmin_obj_id = superAdmin.id;
    req.superAdminDetails = `${superAdmin.firstName} ${superAdmin.lastName} - ${superAdmin.role}`;
    console.log("objeid", req.superAdmin_obj_id);
    console.log("objeiddeaiial", req.superAdminDetails);

    return next();
  } catch (err) {
    console.error("superAdmin Token Error:", err.message);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      msg: err.message || "Token validation failed.",
    });
  }
};
