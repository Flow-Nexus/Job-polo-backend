import prismaDB from "../utlis/prisma.js";
import {
  actionCompleteResponse,
  actionFailedResponse,
} from "../config/common.js";
import {
  availableActionType,
  responseFlags,
  responseMessages,
} from "../config/config.js";
import { sendOTPVerification } from "../utlis/helper/helper.js";
import bcrypt from "bcrypt";
import otpGenerator from "otp-generator";
import { processUploadedFiles } from "../cloud/cloudHelper.js";

/**
 * @desc Send OTP for registration or login
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @return {Object} JSON response with success or error message
 * @route POST /api/v1/auth/employee/send-otp
 * @access Public
 */
export const postJob = async (req, res) => {
  try {
    const posedby =
      req.employerDetails ||
      req.employer_obj_id ||
      req.superAdminDetails ||
      req.superAdmin_obj_id;

    // Check if the user is an Employer
    const employer = await prismaDB.User.findUnique({
      where: { userId },
    });
    if (!employer) {
      return res.status(403).json({
        success: false,
        message: "Only employers can post jobs.",
      });
    }

    // 2️⃣ Extract body data
    const {
      title,
      description,
      requirements,
      responsibilities,
      education,
      experienceMin,
      experienceMax,
      salaryRange,
      location,
      mode,
      employmentType,
      skillsRequired,
      openings,
      deadline,
    } = req.body;

    // 3️⃣ Basic validation
    if (!title || !description || !location) {
      return res.status(400).json({
        success: false,
        message: "Title, description, and location are required.",
      });
    }

    // 4️⃣ Create Job Post
    const job = await prisma.job.create({
      data: {
        title,
        description,
        requirements,
        responsibilities,
        education,
        experienceMin,
        experienceMax,
        salaryRange,
        location,
        mode,
        employmentType,
        skillsRequired,
        openings,
        deadline: deadline ? new Date(deadline) : null,
        employerId: employer.id,
        createdBy: userId,
      },
    });

    // 5️⃣ Response
    return res.status(201).json({
      success: true,
      message: "Job posted successfully!",
      data: job,
    });

  } catch (error) {
    console.error("❌ Error posting job:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while posting job.",
      error: error.message,
    });
  }
};
