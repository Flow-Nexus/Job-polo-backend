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
    const userId = decoded._id || decoded.email;
    // console.log("Decoded Token:", decoded);

    if (!userId) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.UNAUTHORIZED,
        msg: "Invalid token.",
      });
    }

    // Fetch User along with SuperAdmin relation
    const user = await prismaDB.User.findUnique({
      where: { id: userId },
      include: { superAdmin: true },
    });

    if (!user || !user.superAdmin) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.NOT_FOUND,
        msg: "SuperAdmin not found.",
      });
    }

    // Check role and active status
    if (user.role !== roleType.SUPER_ADMIN || !user.superAdmin.is_active) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.UNAUTHORIZED,
        msg: "Unauthorized SuperAdmin. Please contact admin.",
      });
    }

    // Attach info to request
    req.superAdmin_obj_id = user.superAdmin.id;
    req.superAdminDetails = `${user.firstName} ${user.lastName} - ${user.role}`;

    console.log("superAdmin_obj_id:", req.superAdmin_obj_id);
    console.log("superAdminDetails:", req.superAdminDetails);

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
