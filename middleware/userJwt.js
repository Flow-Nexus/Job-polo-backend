import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import prismaDB from "../utlis/prisma.js";
import { actionFailedResponse } from "../config/common.js";
import { responseFlags } from "../config/config.js";

dotenv.config();

export const userJwtToken = async (req, res, next) => {
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
    const userId = decoded._id;

    if (!userId) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.UNAUTHORIZED,
        msg: "Invalid token.",
      });
    }

    const user = await prismaDB.User.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.NOT_FOUND,
        msg: "User not found.",
      });
    }

    // Validate allowed roles
    const allowedRoles = ["ADMIN", "OPERATOR", "USER"];
    if (!allowedRoles.includes(user.role)) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.UNAUTHORIZED,
        msg: "Unauthorized. Access denied for this role.",
      });
    }

    if (!user.is_active) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.UNAUTHORIZED,
        msg: "Unauthorized user. Please contact admin.",
      });
    }

    // Attach user info to request
    req.user_obj_id = user.id;
    req.userDetails = `${user.name} - ${user.role}`;
    console.log("objeid",req.user_obj_id)
    console.log("objeiddeaiial",req.userDetails)

    return next();
  } catch (err) {
    console.error("User Token Error:", err.message);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      msg: err.message || "Token validation failed.",
    });
  }
};
