import prismaDB from "../utlis/prisma.js";
import {
  actionCompleteResponse,
  actionFailedResponse,
} from "../config/common.js";
import {
  actionType,
  ApplicationStatus,
  availableApplicationStatus,
  responseFlags,
  responseMessages,
  uploadFolderName,
} from "../config/config.js";
import { processUploadedFiles } from "../cloud/cloudHelper.js";
import { deleteFileFromCloudinary } from "../cloud/cloudinaryCloudStorage.js";
import { application } from "express";

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
      companyName,
      companyEmail,
      addresses,
      employmentType,
      skillsRequired,
      openings,
      deadline,
      // categoryId,
    } = req.body;
    const jobLogoFiles = req.files?.logoFiles || [];

    // Basic validation
    if (
      !title ||
      !description ||
      !addresses ||
      !companyName ||
      !companyEmail
      // !categoryId
    ) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.PARAMETER_MISSING,
        msg: responseMessages.PARAMETER_MISSING,
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(companyEmail)) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "Invalid email format",
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
      // console.log("employer", employer);
      if (!employer) {
        return actionFailedResponse({
          res,
          errorCode: responseFlags.NOT_FOUND,
          msg: "Employer record not found for this user.",
        });
      }
      employerId = employer?.id;
      useremail = employer?.user?.email;
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
      superAdminId = superAdmin?.id;
      useremail = superAdmin?.user?.email;
    }

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
        companyName,
        companyEmail,
        // categoryId,
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
      companyEmail,
      companyName,
      isActive,
    } = req.body;
    const jobLogoFiles = req.files?.logoFiles || [];
    const action = actionType.UPDATEJOBPOST;

    if (!jobId || !title || !addresses || !companyEmail || !companyName) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.PARAMETER_MISSING,
        msg: responseMessages.PARAMETER_MISSING,
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(companyEmail)) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "Invalid email format",
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
        companyEmail: companyEmail ?? existingJob.companyEmail,
        companyName: companyName ?? existingJob.companyName,
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
 * @access Public
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
      userId,
      country,
      page,
      limit,
      is_active,
    } = req.query;

    // Convert pagination params safely
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;
    const skip = (pageNum - 1) * limitNum;
    const take = limitNum;

    // Convert is_active to Boolean if provided
    const isActiveBool =
      typeof is_active === "string"
        ? is_active.toLowerCase() === "true"
        : undefined;

    // Construct where conditions
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
        // Filter by User ID (matches either Employer.userId )
        userId
          ? {
              OR: [{ employer: { userId } }, { superAdmin: { userId } }],
            }
          : {},
        // Filter by job active status
        isActiveBool !== undefined ? { is_active: isActiveBool } : {},
      ],
    };

    const jobs = await prismaDB.Job.findMany({
      where,
      skip,
      take,
      include: {
        jobPostAddresses: true,
        employer: {
          include: { user: true },
        },
        superAdmin: {
          include: { user: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const total = await prismaDB.Job.count({ where });

    const msg = "Jobs fetched successfully";
    return actionCompleteResponse({
      res,
      msg,
      data: { page: pageNum, limit: limitNum, total, jobs },
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

/**
 * @desc Apply Job by Employee
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @return {Object} JSON response with success or error message
 * @route POST /api/v1/job/employee/apply-job
 * @access Employee
 */
export const applyForJob = async (req, res) => {
  try {
    const employeeIdBy = req.employee_obj_id;
    const appliedBy = req.employeeDetails;
    const { jobId, howFitRole } = req.body;

    const resumeFiles = req.files?.resumeFiles || [];
    const workSampleFiles = req.files?.workSampleFiles || [];

    // Validate Input
    if (!jobId) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.PARAMETER_MISSING,
        msg: responseMessages.PARAMETER_MISSING,
      });
    }

    // Verify employee existence
    const employee = await prismaDB.Employee.findUnique({
      where: { userId: employeeIdBy },
      include: { user: true },
    });
    if (!employee) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.NOT_FOUND,
        msg: "Employee record not found.",
      });
    }

    const userEmail = employee.user.email;

    // Verify job existence and status
    const job = await prismaDB.Job.findUnique({
      where: { id: jobId },
      include: {
        employer: { include: { user: true } },
        superAdmin: { include: { user: true } },
      },
    });

    if (!job || !job.is_active) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.NOT_FOUND,
        msg: "Job not found or inactive.",
      });
    }

    // Prevent duplicate applications
    const alreadyApplied = await prismaDB.JobApplication.findFirst({
      where: {
        jobId,
        employeeId: employee.id,
        is_active: true,
      },
    });
    if (alreadyApplied) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.CONFLICT,
        msg: "You have already applied for this job.",
      });
    }

    // ---------- FILE UPLOAD ----------
    let resumeUrls = [];
    let resumePreviewUrls = [];
    let workSampleUrls = [];
    let workSamplePreviewUrls = [];

    // Handle Resume Upload or Fallback
    if (resumeFiles.length > 0) {
      // Upload new resume(s)
      const resumeResults = await processUploadedFiles(
        resumeFiles,
        uploadFolderName.EMPLOYEE_RESUME,
        userEmail
      );
      resumeUrls = resumeResults.imageUrlsArray;
      resumePreviewUrls = resumeResults.previewUrlsArray;

      // Update employee profile with latest resume (optional)
      await prismaDB.Employee.update({
        where: { id: employee.id },
        data: {
          resumeUrls: [...(employee.resumeUrls || []), ...resumeUrls],
          resumePreviewUrls: [
            ...(employee.resumePreviewUrls || []),
            ...resumePreviewUrls,
          ],
        },
      });
    } else if (employee.resumeUrls && employee.resumeUrls.length > 0) {
      // Use last uploaded resume
      resumeUrls = [employee.resumeUrls[employee.resumeUrls.length - 1]];
      resumePreviewUrls = [
        employee.resumePreviewUrls[employee.resumePreviewUrls.length - 1],
      ];
    } else {
      // No resume available at all
      return actionFailedResponse({
        res,
        errorCode: responseFlags.PARAMETER_MISSING,
        msg: "Resume is required to apply for this job.",
      });
    }

    // Handle Work Sample Upload or Fallback
    if (workSampleFiles.length > 0) {
      const workSampleResults = await processUploadedFiles(
        workSampleFiles,
        uploadFolderName.EMPLOYEE_WORK_SAMPLE,
        userEmail
      );
      workSampleUrls = workSampleResults.imageUrlsArray;
      workSamplePreviewUrls = workSampleResults.previewUrlsArray;

      // Update employee work sample history (optional)
      await prismaDB.Employee.update({
        where: { id: employee.id },
        data: {
          workSampleUrls: [
            ...(employee.workSampleUrls || []),
            ...workSampleUrls,
          ],
          workSamplePreviewUrls: [
            ...(employee.workSamplePreviewUrls || []),
            ...workSamplePreviewUrls,
          ],
        },
      });
    } else if (employee.workSampleUrls && employee.workSampleUrls.length > 0) {
      // Use last uploaded work sample
      workSampleUrls = [
        employee.workSampleUrls[employee.workSampleUrls.length - 1],
      ];
      workSamplePreviewUrls = [
        employee.workSamplePreviewUrls[
          employee.workSamplePreviewUrls.length - 1
        ],
      ];
    } else {
      // No work sample — allowed
      workSampleUrls = null;
      workSamplePreviewUrls = null;
    }

    // Check if a withdrawn application exists
    const withdrawnApplication = await prismaDB.JobApplication.findFirst({
      where: {
        jobId,
        employeeId: employee.id,
        is_active: false,
      },
    });

    let jobApplication;
    let msg;

    if (withdrawnApplication) {
      // Reactivate withdrawn application
      jobApplication = await prismaDB.JobApplication.update({
        where: { id: withdrawnApplication.id },
        data: {
          is_active: true,
          status: ApplicationStatus.RE_APPLIED,
          appliedBy: appliedBy,
          howFitRole: howFitRole || null,
          statusReason: "Re-Applied application successfully after withdrawal",
          resumeUrls,
          resumePreviewUrls,
          workSampleUrls,
          workSamplePreviewUrls,
        },
        include: {
          job: {
            include: {
              // employer: true,
              // superAdmin: true,
              jobPostAddresses: true,
            },
          },
        },
      });
      msg = "Job application Re-Applied successfully!";
    } else {
      // Create new application
      jobApplication = await prismaDB.JobApplication.create({
        data: {
          jobId,
          status: ApplicationStatus.APPLIED,
          employeeId: employee.id,
          userId: employeeIdBy,
          statusReason: "Applied the application successfully",
          howFitRole: howFitRole || null,
          appliedBy: appliedBy,
          resumeUrls,
          resumePreviewUrls,
          workSampleUrls,
          workSamplePreviewUrls,
        },
        include: {
          job: {
            include: {
              // employer: true,
              // superAdmin: true,
              jobPostAddresses: true,
            },
          },
        },
      });
      msg = "Job application submitted successfully!";
    }

    // Success Response
    return actionCompleteResponse({
      res,
      msg,
      data: { jobApplication },
    });
  } catch (error) {
    console.error("Error applying for job:", error);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      msg: error.message || "Server error while applying for job.",
    });
  }
};

/**
 * @desc Withdraw Job Application by Employee
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @return {Object} JSON response with success or error message
 * @route POST /api/v1/job/employee/withraw-job
 * @access Employee
 */
export const withdrawJobApplication = async (req, res) => {
  try {
    const employeeId = req.employee_obj_id;
    const withdraw = req.employeeDetails;
    const { applicationId, reason } = req.query;

    if (!applicationId || !reason) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.PARAMETER_MISSING,
        msg: responseMessages.PARAMETER_MISSING,
      });
    }

    // Fetch the job application
    const jobApplication = await prismaDB.JobApplication.findUnique({
      where: { id: applicationId },
      include: { job: { include: { jobPostAddresses: true } } },
    });

    if (!jobApplication || !jobApplication.is_active) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.NOT_FOUND,
        msg: "Job application not found or already withdrawn",
      });
    }

    // Ensure the employee owns this application
    if (jobApplication.userId !== employeeId) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.UNAUTHORIZED,
        msg: "You are not authorized to withdraw this application",
      });
    }

    // Only allow withdrawal if job is active
    if (!jobApplication.job.is_active) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "Cannot withdraw application because the job is no longer active",
      });
    }

    // Mark as withdrawn
    const withdrawnApplication = await prismaDB.JobApplication.update({
      where: { id: applicationId },
      data: {
        is_active: false,
        status: ApplicationStatus.WITHDRAW,
        statusReason: reason,
        withdrawBy: withdraw,
      },
      include: { job: { include: { jobPostAddresses: true } } },
    });

    const msg = "Job application withdrawn successfully";
    return actionCompleteResponse({
      res,
      msg,
      data: { withdrawnApplication },
    });
  } catch (error) {
    console.error("Error withdrawing job application:", error);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      msg: error.message || "Server error while withdrawing application",
    });
  }
};

/**
 * @desc Job Apllication Status Change by Employer and Super Admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @return {Object} JSON response with success or error message
 * @route POST /api/v1/job/employer/update-job-application-status
 * @access Employer/Super Admin
 */
export const updateJobApplicationStatus = async (req, res) => {
  try {
    const { applicationId, newStatus, reason } = req.body;
    const updatedBy = req.employeeDetails || req.superAdminDetails;

    // Validate required parameters
    if (!applicationId || !newStatus) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.PARAMETER_MISSING,
        msg: responseMessages.PARAMETER_MISSING,
      });
    }

    // Find the application
    const application = await prismaDB.JobApplication.findUnique({
      where: { id: applicationId },
      include: { job: { include: { jobPostAddresses: true } } },
    });

    if (!application) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.NOT_FOUND,
        msg: "Job application not found",
      });
    }

    // prevent updating withdrawn or inactive applications
    if (!application.is_active) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.CONFLICT,
        msg: "Cannot update status of inactive or withdrawn application",
      });
    }

    // Update application status
    const updatedApplication = await prismaDB.JobApplication.update({
      where: { id: applicationId },
      data: {
        status: newStatus,
        statusReason: reason || null,
        updatedBy,
      },
      include: {
        job: { include: { jobPostAddresses: true } },
      },
    });

    const msg = `Job application status updated to ${newStatus}`;
    return actionCompleteResponse({
      res,
      msg,
      data: { updatedApplication },
    });
  } catch (error) {
    console.error("Error updating job application status:", error);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      msg: error.message || "Server error while updating status",
    });
  }
};

/**
 * @desc Get Active Job Apllication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @return {Object} JSON response with success or error message
 * @route POST /api/v1/job/employer/get-active-job-applications/:jobId
 * @access Employer/Super Admin
 */
export const getActiveJobApplications = async (req, res) => {
  try {
    const {
      jobId,
      employeeId,
      status, // filter by ApplicationStatus
      appliedBy, // who applied
      startDate, // filter applications from this date
      endDate, // filter applications until this date
      search, // text search on employee name or job title
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    const filters = { is_active: true };

    if (jobId) filters.jobId = jobId;
    if (employeeId) filters.employeeId = employeeId;
    if (status) filters.status = status;
    if (appliedBy) filters.appliedBy = appliedBy;

    // Date filter
    if (startDate || endDate) {
      filters.createdAt = {};
      if (startDate) filters.createdAt.gte = new Date(startDate);
      if (endDate) filters.createdAt.lte = new Date(endDate);
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Search filter (on employee name or job title)
    const searchFilter = search
      ? {
          OR: [
            {
              employee: {
                user: { name: { contains: search, mode: "insensitive" } },
              },
            },
            { job: { title: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {};

    // Fetch from DB
    const jobApplications = await prismaDB.JobApplication.findMany({
      where: {
        ...filters,
        ...searchFilter,
      },
      include: {
        employee: { include: { user: true } },
        job: {
          include: {
            employer: { include: { user: true } },
            jobPostAddresses: true,
          },
        },
      },
      skip,
      take,
      orderBy: { [sortBy]: order },
    });

    // Total count for pagination
    const total = await prismaDB.JobApplication.count({
      where: {
        ...filters,
        ...searchFilter,
      },
    });

    return actionCompleteResponse({
      res,
      msg: "Job applications fetched successfully",
      data: {
        jobApplications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching job applications:", error);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      msg: error.message || "Server error while fetching job applications",
    });
  }
};

/**
 * @desc Get Job Apllication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @return {Object} JSON response with success or error message
 * @route POST /api/v1/job/super-admin/get-all-job-applications
 * @access Super Admin
 */
export const getAllJobApplications = async (req, res) => {
  try {
    const {
      jobId,
      employeeId,
      status, // filter by ApplicationStatus
      appliedBy, // who applied
      startDate, // filter applications from this date
      endDate, // filter applications until this date
      search, // text search on employee name or job title
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    const filters = {};

    if (jobId) filters.jobId = jobId;
    if (employeeId) filters.employeeId = employeeId;
    if (status) filters.status = status;
    if (appliedBy) filters.appliedBy = appliedBy;

    // Date filter
    if (startDate || endDate) {
      filters.createdAt = {};
      if (startDate) filters.createdAt.gte = new Date(startDate);
      if (endDate) filters.createdAt.lte = new Date(endDate);
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Search filter (on employee name or job title)
    const searchFilter = search
      ? {
          OR: [
            {
              employee: {
                user: { name: { contains: search, mode: "insensitive" } },
              },
            },
            { job: { title: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {};

    // Fetch from DB
    const jobApplications = await prismaDB.JobApplication.findMany({
      where: {
        ...filters,
        ...searchFilter,
      },
      include: {
        employee: { include: { user: true } },
        job: {
          include: {
            employer: { include: { user: true } },
            jobPostAddresses: true,
          },
        },
      },
      skip,
      take,
      orderBy: { [sortBy]: order },
    });

    // Total count for pagination
    const total = await prismaDB.JobApplication.count({
      where: {
        ...filters,
        ...searchFilter,
      },
    });

    return actionCompleteResponse({
      res,
      msg: "Job applications fetched successfully",
      data: {
        jobApplications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching job applications:", error);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      msg: error.message || "Server error while fetching job applications",
    });
  }
};
