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
      throw new Error("Permission denied. Token is missing.");
    }

    // Decode and verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const employerId = decoded._id;

    if (!employerId) {
      throw new Error("Invalid token.");
    }

    const employer = await prismaDB.User.findUnique({
      where: { id: employerId },
    });

    if (!employer) {
      throw new Error("employer not found.");
    }

    // Check if the role is OPERATOR or USER
    if (
      employer.role !== roleType.EMPLOYER &&
      employer.role !== roleType.SUPERADMIN
    ) {
      throw new Error("Unauthorized. employer or Super Admin access only.");
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
    console.log("objeid", req.employer_obj_id);
    console.log("objeiddeaiial", req.employerDetails);

    return next();
  } catch (err) {
    console.error("Operator Token Error:", err.message);
    return actionFailedResponse(res, null, err.message);
  }
};
