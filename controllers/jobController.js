import prismaDB from "../utlis/prisma.js";
import {
  actionCompleteResponse,
  actionFailedResponse,
} from "../config/common.js";
import {
  actionType,
  availableActionType,
  responseFlags,
  responseMessages,
  uploadFolderName,
} from "../config/config.js";
import { sendOTPVerification } from "../utlis/helper/helper.js";
import bcrypt from "bcrypt";
import otpGenerator from "otp-generator";
import { processUploadedFiles } from "../cloud/cloudHelper.js";

/**
 * @desc Job Post by Employee and Super Admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @return {Object} JSON response with success or error message
 * @route POST /api/v1/job/employer/post-job
 * @access Employer || Super Admin
 */
export const postJob = async (req, res) => {
  try {
    const postedby = req.employerDetails || req.superAdminDetails;
    const userId = req.employer_obj_id || req.superAdmin_obj_id;
    const {
      title,
      description,
      requirements,
      responsibilities,
      education,
      experienceRange,
      salaryRange,
      mode,
      addresses,
      employmentType,
      skillsRequired,
      openings,
      deadline,
      otp,
    } = req.body;
    const jobLogoFiles = req.files?.logoFiles || [];
    const action = actionType.JOBPOST;

    // Basic validation
    if (!title || !description || !addresses) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.PARAMETER_MISSING,
        msg: responseMessages.PARAMETER_MISSING,
      });
    }

    // Determine Employer/SuperAdmin record
    let employerRecord = null;

    if (!userId) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.FORBIDDEN,
        msg: "User not authorized to post a job.",
      });
    }

    if (req.employer_obj_id) {
      // Employer posting
      employerRecord = await prismaDB.Employer.findUnique({
        where: { userId: req.employer_obj_id },
      });

      if (!employerRecord) {
        return actionFailedResponse({
          res,
          errorCode: responseFlags.NOT_FOUND,
          msg: "Employer record not found for this user.",
        });
      }
    } else if (req.superAdmin_obj_id) {
      // SuperAdmin posting
      const superAdminRecord = await prismaDB.SuperAdmin.findUnique({
        where: { userId: req.superAdmin_obj_id },
      });

      if (!superAdminRecord) {
        return actionFailedResponse({
          res,
          errorCode: responseFlags.NOT_FOUND,
          msg: "Super Admin record not found for this user.",
        });
      }

      // Optional: create an Employer record for SuperAdmin if needed
      employerRecord = await prismaDB.Employer.upsert({
        where: { userId: req.superAdmin_obj_id },
        update: {},
        create: {
          userId: req.superAdmin_obj_id,
          companyName: "Super Admin",
        },
      });
    }

    // Now always use the correct Employer.id
    const employerIdForJob = employerRecord.id;

    // ---------- OTP VERIFICATION ----------
    const recentOtp = await prismaDB.OTP.findFirst({
      where: { email: useremail, action },
      orderBy: { createdAt: "desc" },
    });

    if (!recentOtp) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.NOT_FOUND,
        msg: "OTP not found or expired",
      });
    }

    if (recentOtp.expiresAt < new Date()) {
      await prismaDB.OTP.delete({ where: { id: recentOtp.id } });
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "OTP expired. Please request a new one.",
      });
    }

    if (recentOtp.otp !== otp) {
      await prismaDB.OTP.delete({ where: { id: recentOtp.id } });
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "Invalid OTP",
      });
    }

    // Delete used OTP
    await prismaDB.OTP.delete({ where: { id: recentOtp.id } });

    // NEW PART: Handle file uploads
    let logoUrl = null;
    let logoPreviewUrl = null;
    console.log("logoUrl", logoUrl);

    if (jobLogoFiles.length > 0) {
      const logoResults = await processUploadedFiles(
        jobLogoFiles,
        uploadFolderName.JOB_POST_LOGO,
        title
      );
      logoUrl = logoResults.imageUrlsArray?.[0] || null;
      logoPreviewUrl = logoResults.previewUrlsArray?.[0] || null;
    }

    // Ensure addresses are an array
    let addressesArray = [];
    try {
      if (typeof addresses === "string") {
        addressesArray = JSON.parse(addresses);
      } else if (Array.isArray(addresses)) {
        addressesArray = addresses;
      }
    } catch (e) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "Invalid address format. Must be JSON array.",
      });
    }

    if (!addressesArray.length) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.PARAMETER_MISSING,
        msg: "At least one address is required.",
      });
    }

    // check for dd-mm-yyyy
    let formattedDeadline = null;

    if (deadline) {
      formattedDeadline = new Date(deadline); // Works fine for "2001-09-29"
      if (isNaN(formattedDeadline.getTime())) {
        formattedDeadline = null;
      }
    }

    // Create Job + Addresses in one transaction
    const job = await prismaDB.Job.create({
      data: {
        title,
        description,
        requirements,
        responsibilities,
        education,
        experienceRange,
        salaryRange,
        mode,
        logoUrl,
        logoPreviewUrl,
        employmentType,
        skillsRequired: Array.isArray(skillsRequired)
          ? skillsRequired
          : typeof skillsRequired === "string"
          ? JSON.parse(skillsRequired)
          : [],
        openings: Number(openings) || 0,
        deadline: formattedDeadline,
        employerId: userId,
        createdBy: postedby,
        jobPostAddresses: {
          create: addressesArray.map((addr) => ({
            city: addr.city,
            state: addr.state,
            country: addr.country,
            pincode: addr.pincode,
            building: addr.building,
            floor: addr.floor,
            apartment: addr.apartment,
            landmark: addr.landmark,
            additionalInfo: addr.additionalInfo,
            createdBy: postedby,
          })),
        },
      },
      include: { jobPostAddresses: true },
    });

    // Success Response
    const msg = "Job posted successfully!";
    return actionCompleteResponse({
      res,
      msg,
      data: { job },
    });
  } catch (error) {
    console.error("Error posting job:", error);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      msg: error.message || "Server error while posting job.",
    });
  }
};
