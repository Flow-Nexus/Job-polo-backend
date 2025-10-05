import dotenv from "dotenv";
import { responseFlags, tokenDetails } from "./config.js";
import jwt from "jsonwebtoken";
import { responseMessages } from "./config.js";
import Razorpay from "razorpay";
import { OAuth2Client } from "google-auth-library";

dotenv.config();

// razorpay
export const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

//for Google Auth login.
export const googleClient = new OAuth2Client(process.env.JOBPOLO_GOOGLE_CLIENT_ID);


//success status message
export const actionCompleteResponse = ({ res, msg, data }) => {
  return res.status(responseFlags.ACTION_COMPLETE).json({
    success: true,
    status: responseFlags.ACTION_COMPLETE,
    message: msg || responseMessages.ACTION_COMPLETE,
    data: data || {},
  });
};

//failed status message
export const actionFailedResponse = ({ res, errorCode, msg }) => {
  return res.status(errorCode).json({
    success: false,
    status: errorCode,
    msg: msg || responseMessages.ACTION_FAILED,
  });
};

//generate token
export const generateAccessToken = (details, expiry = "30d") => {
  console.log("expiry", expiry);
  try {
    return jwt.sign(details, tokenDetails.JWT_SECRET, {
      expiresIn: expiry,
    });
  } catch (e) {
    throw new Error(e.message);
  }
};

// middleware/parseJsonFields.js
export const parseJsonFields = (req, res, next) => {
  try {
    if (typeof req.body.categoryTypeIds === "string") {
      req.body.categoryTypeIds = JSON.parse(req.body.categoryTypeIds);
    }
  } catch (error) {
    console.error("Invalid JSON in categoryTypeIds:", error);
    // fallback to array with one item if comma-separated
    req.body.categoryTypeIds = req.body.categoryTypeIds?.split(",") || [];
  }
  next();
};