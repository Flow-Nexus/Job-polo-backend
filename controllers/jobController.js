import prismaDB from "../utlis/prisma.js";
import {
  actionCompleteResponse,
  actionFailedResponse,
} from "../config/common.js";
import {
  actionType,
  responseFlags,
  responseMessages,
  uploadFolderName,
} from "../config/config.js";
import { processUploadedFiles } from "../cloud/cloudHelper.js";
import { deleteFileFromCloudinary } from "../cloud/cloudinaryCloudStorage.js";

/**
 * @desc Job Post by Employer and Super Admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @return {Object} JSON response with success or error message
 * @route POST /api/v1/job/employer/post-job
 * @access Employer || Super Admin
 */
export const postJob = async (req, res) => {
  try {
    const postedby = req.employerDetails || req.superAdminDetails;
    const superAdminIdBy = req.superAdmin_obj_id;
    const employeeIdBy = req.employer_obj_id;
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

    // Determine who is posting
    let useremail = null;
    let employerId = null;
    let superAdminId = null;

    if (employeeIdBy) {
      // EMPLOYER POSTING
      const employer = await prismaDB.Employer.findUnique({
        where: { userId: employeeIdBy },
      });
      console.log("employer", employer);
      if (!employer) {
        return actionFailedResponse({
          res,
          errorCode: responseFlags.NOT_FOUND,
          msg: "Employer record not found for this user.",
        });
      }
      employerId = employer.id;
      useremail = employer.user.email;
    }

    if (superAdminIdBy) {
      // SUPERADMIN POSTING
      const superAdmin = await prismaDB.SuperAdmin.findUnique({
        where: { userId: superAdminIdBy },
        include: { user: true },
      });
      console.log("superAdmin", superAdmin);
      if (!superAdmin) {
        return actionFailedResponse({
          res,
          errorCode: responseFlags.NOT_FOUND,
          msg: "Super Admin record not found for this user.",
        });
      }
      superAdminId = superAdmin.id;
      useremail = superAdmin.user.email;
    }

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

    // ---------- FILE UPLOAD ----------
    let logoUrl = null;
    let logoPreviewUrl = null;

    if (jobLogoFiles.length > 0) {
      const logoResults = await processUploadedFiles(
        jobLogoFiles,
        uploadFolderName.JOB_POST_LOGO,
        useremail
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

    // ---------- DEADLINE ----------
    let formattedDeadline = null;
    if (deadline) {
      formattedDeadline = new Date(deadline); // for "2001-09-29"
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
        employerId: employerId,
        superAdminId: superAdminId,
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

/**
 * @desc Job UPDATE by Employer and Super Admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @return {Object} JSON response with success or error message
 * @route PUT /api/v1/job/employer/update-job/:jobId
 * @access Employer || Super Admin
 */
export const updateJob = async (req, res) => {
  try {
    const postedby = req.employerDetails || req.superAdminDetails;
    const superAdminIdBy = req.superAdmin_obj_id;
    const employeeIdBy = req.employer_obj_id;
    const { jobId } = req.params;
    const {
      addresses,
      title,
      description,
      requirements,
      responsibilities,
      education,
      experienceRange,
      salaryRange,
      mode,
      employmentType,
      skillsRequired,
      openings,
      deadline,
      otp,
      isActive,
    } = req.body;
    const jobLogoFiles = req.files?.logoFiles || [];
    const action = actionType.UPDATEJOBPOST;

    if (!jobId || !title || !addresses) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.PARAMETER_MISSING,
        msg: responseMessages.PARAMETER_MISSING,
      });
    }

    // Check if job exists
    const existingJob = await prismaDB.Job.findUnique({
      where: { id: jobId },
    });
    if (!existingJob) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.NOT_FOUND,
        msg: "Job not found.",
      });
    }

    // Determine who is posting
    let useremail = null;
    let employerId = null;
    let superAdminId = null;

    if (employeeIdBy) {
      // EMPLOYER POSTING
      const employer = await prismaDB.Employer.findUnique({
        where: { userId: employeeIdBy },
        include: { user: true },
      });
      console.log("employer", employer);
      if (!employer) {
        return actionFailedResponse({
          res,
          errorCode: responseFlags.NOT_FOUND,
          msg: "Employer record not found for this user.",
        });
      }
      employerId = employer.id;
      useremail = employer.user.email;
    }

    if (superAdminIdBy) {
      // SUPERADMIN POSTING
      const superAdmin = await prismaDB.SuperAdmin.findUnique({
        where: { userId: superAdminIdBy },
        include: { user: true },
      });
      console.log("superAdmin", superAdmin);
      if (!superAdmin) {
        return actionFailedResponse({
          res,
          errorCode: responseFlags.NOT_FOUND,
          msg: "Super Admin record not found for this user.",
        });
      }
      superAdminId = superAdmin.id;
      useremail = superAdmin.user.email;
    }

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

    // ---------- FILE UPLOAD ----------
    let logoUrl = null;
    let logoPreviewUrl = null;

    if (jobLogoFiles.length > 0) {
      const logoResults = await processUploadedFiles(
        jobLogoFiles,
        uploadFolderName.JOB_POST_LOGO,
        useremail
      );
      logoUrl = logoResults.imageUrlsArray?.[0] || null;
      logoPreviewUrl = logoResults.previewUrlsArray?.[0] || null;
    }

    // ---------- Handle addresses ----------
    let addressesArray = [];
    if (addresses) {
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
          msg: "Invalid address format. Must be a JSON array.",
        });
      }
    }

    // ---------- Handle skillsRequired ----------
    let skillsArray = [];
    if (skillsRequired) {
      if (typeof skillsRequired === "string") {
        try {
          skillsArray = JSON.parse(skillsRequired);
        } catch {
          skillsArray = [skillsRequired];
        }
      } else if (Array.isArray(skillsRequired)) {
        skillsArray = skillsRequired;
      }
    }

    // ---------- Handle deadline ----------
    let formattedDeadline = null;
    if (deadline) {
      const parsed = new Date(deadline);
      if (!isNaN(parsed.getTime())) formattedDeadline = parsed;
    }

    // ---------- Update job ----------
    const updatedJob = await prismaDB.Job.update({
      where: { id: jobId },
      data: {
        // Main fields (conditionally update if provided)
        title: title ?? existingJob.title,
        description: description ?? existingJob.description,
        requirements: requirements ?? existingJob.requirements,
        responsibilities: responsibilities ?? existingJob.responsibilities,
        education: education ?? existingJob.education,
        experienceRange: experienceRange ?? existingJob.experienceRange,
        salaryRange: salaryRange ?? existingJob.salaryRange,
        mode: mode ?? existingJob.mode,
        employmentType: employmentType ?? existingJob.employmentType,
        openings: openings ? Number(openings) : existingJob.openings,
        skillsRequired: skillsArray.length
          ? skillsArray
          : existingJob.skillsRequired,
        deadline: formattedDeadline ?? existingJob.deadline,
        logoUrl: logoUrl ?? existingJob.logoUrl,
        logoPreviewUrl: logoPreviewUrl ?? existingJob.logoPreviewUrl,
        is_active: isActive ?? true,
        employerId: employerId,
        superAdminId: superAdminId,
        updatedBy: postedby,
        // Replace addresses (if any provided)
        jobPostAddresses: addressesArray.length
          ? {
              deleteMany: {}, // delete old ones
              create: addressesArray?.map((addr) => ({
                city: addr.city,
                state: addr.state,
                country: addr.country,
                pincode: addr.pincode,
                building: addr.building,
                floor: addr.floor,
                apartment: addr.apartment,
                landmark: addr.landmark,
                additionalInfo: addr.additionalInfo,
                is_active: addr.isActive ?? true,
                updatedBy: postedby,
              })),
            }
          : undefined,
      },
      include: { jobPostAddresses: true },
    });

    const msg = "Job updated successfully";
    return actionCompleteResponse({
      res,
      msg,
      data: { updatedJob },
    });
  } catch (error) {
    console.error("Error updating job:", error);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      msg: error.message || "Updating Job Failed",
    });
  }
};

/**
 * @desc Job Get by Employee, Employer and Super Admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @return {Object} JSON response with success or error message
 * @route POST /api/v1/job/employer/get-job-with
 * @access Employer || Super Admin
 */
export const getJobsWithFilter = async (req, res) => {
  try {
    const {
      search,
      mode,
      employmentType,
      city,
      pincode,
      state,
      country,
      page,
      limit,
    } = req.query;

    // Convert pagination params
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where = {
      AND: [
        search
          ? {
              OR: [
                { title: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
              ],
            }
          : {},
        mode ? { mode } : {},
        employmentType ? { employmentType } : {},
        city || state || country || pincode
          ? {
              jobPostAddresses: {
                some: {
                  city: city
                    ? { contains: city, mode: "insensitive" }
                    : undefined,
                  state: state
                    ? { contains: state, mode: "insensitive" }
                    : undefined,
                  country: country
                    ? { contains: country, mode: "insensitive" }
                    : undefined,
                  pincode: pincode
                    ? { contains: pincode, mode: "insensitive" }
                    : undefined,
                },
              },
            }
          : {},
      ],
    };

    const jobs = await prismaDB.Job.findMany({
      where,
      skip,
      take,
      include: {
        jobPostAddresses: true,
        employer: true,
        superAdmin: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const total = await prismaDB.Job.count({ where });

    const msg = "Jobs fetched successfully";
    return actionCompleteResponse({
      res,
      msg,
      data: { page, limit, total, jobs },
    });
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      msg: error.message || "Fetching Item Error",
    });
  }
};

/**
 * @desc Job Delete by Employer and Super Admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @return {Object} JSON response with success or error message
 * @route POST /api/v1/job/employer/delete-job/:jobId
 * @access Employer || Super Admin
 */
export const deleteJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.PARAMETER_MISSING,
        msg: responseMessages.PARAMETER_MISSING,
      });
    }

    // Fetch job with addresses
    const existingJob = await prismaDB.job.findUnique({
      where: { id: jobId },
      include: { jobPostAddresses: true },
    });

    if (!existingJob) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.NOT_FOUND,
        msg: "Job not found.",
      });
    }

    // Delete logo files from Cloudinary
    const logoUrls = [existingJob.logoUrl, existingJob.logoPreviewUrl].filter(
      Boolean
    );
    for (const url of logoUrls) {
      try {
        await deleteFileFromCloudinary(url);
      } catch (e) {
        console.warn("Failed to delete file from Cloudinary:", e.message);
      }
    }

    // Delete associated addresses
    if (existingJob.jobPostAddresses?.length) {
      await prismaDB.address.deleteMany({
        where: { jobId },
      });
    }

    // Delete the job itself
    const job = await prismaDB.job.delete({ where: { id: jobId } });

    const msg = "Job and associated files deleted successfully.";
    return actionCompleteResponse({
      res,
      msg,
      data: { job },
    });
  } catch (error) {
    console.error("Error deleting job:", error);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      msg: error.message || "Error deleting job",
    });
  }
};
