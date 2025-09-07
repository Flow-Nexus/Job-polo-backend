import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import prismaDB from "../utils/prisma.js";
import { actionFailedResponse } from "../config/common.js";

dotenv.config();

export const operatorJwtToken = async (req, res, next) => {
  const token = req.headers["x-access-token"];

  try {
    if (!token) {
      throw new Error("Permission denied. Token is missing.");
    }

    // Decode and verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded._id;

    if (!userId) {
      throw new Error("Invalid token.");
    }

    const user = await prismaDB.User.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found.");
    }

    // Check if the role is OPERATOR or USER
    if (user.role !== "OPERATOR" && user.role !== "ADMIN") {
      throw new Error("Unauthorized. Operator or Admin access only.");
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        status: 401,
        message: "Unauthorised User, Please Contact Admin",
      });
    }

    req.operator_obj_id = user.id;
    req.operatorDetails = `${user.name} - ${user.role}`;
    console.log("objeid",req.operator_obj_id)
    console.log("objeiddeaiial",req.operatorDetails)

    return next();
  } catch (err) {
    console.error("Operator Token Error:", err.message);
    return actionFailedResponse(res, null, err.message);
  }
};
