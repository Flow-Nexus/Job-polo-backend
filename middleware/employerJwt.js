import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { actionFailedResponse } from "../config/common.js";
import prismaDB from "../utlis/prisma.js";
import { roleType } from "../config/config.js";

dotenv.config();

export const employerJwtToken = async (req, res, next) => {
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
    const employerId = decoded._id || decoded.email;
    // console.log("Decoded Token:", decoded);

    if (!employerId) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.UNAUTHORIZED,
        msg: "Invalid token.",
      });
    }

    const employer = await prismaDB.User.findUnique({
      where: { id: employerId },
      include: { employer: true },
    });

    if (!employer) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.NOT_FOUND,
        msg: "User not found.",
      });
    }

    // Check if the role is OPERATOR or USER
    if (
      employer.role !== roleType.EMPLOYER &&
      employer.role !== roleType.SUPER_ADMIN
    ) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.UNAUTHORIZED,
        msg: "Unauthorized. Access denied for this role.",
      });
    }

    // Check if employer is active
    if (!employer.is_active) {
      return res.status(401).json({
        success: false,
        status: 401,
        message: "Unauthorised employer, Please Contact Admin",
      });
    }

    req.employer_obj_id = employer.id;
    req.employerDetails = `${employer.firstName} ${employer.lastName} - ${employer.role}`;

    console.log("employer_obj_id", req.employer_obj_id);
    console.log("employerDetails", req.employerDetails);

    return next();
  } catch (err) {
    console.error("Employer Token Error:", err.message);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      msg: err.message || "Token validation failed.",
    });
  }
};
