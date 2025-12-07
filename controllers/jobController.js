import prismaDB from "../utlis/prisma.js";
import {
  actionCompleteResponse,
  actionFailedResponse,
} from "../config/common.js";
import {
  actionType,
  ApplicationStatus,
  availableSalaryType,
  availableSaveViewType,
  availableShiftType,
  responseFlags,
  responseMessages,
  SaveViewType,
  uploadFolderName,
} from "../config/config.js";
import { processUploadedFiles } from "../cloud/cloudHelper.js";
import { deleteFileFromCloudinary } from "../cloud/cloudinaryCloudStorage.js";
import { JobApplicationStatusMessages } from "../utlis/utlis.js";
import { sendApplicationStatusEmail } from "../utlis/helper/helper.js";

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
      mode,
      companyName,
      companyEmail,
      addresses,
      employmentType,
      skillsRequired,
      openings,
      deadline,
      categoryId,
      minExperience,
      maxExperience,
      salaryType,
      minSalary,
      maxSalary,
      shiftType,
      questionnaire,
    } = req.body;
    const jobLogoFiles = req.files?.logoFiles || [];

    // Basic validation
    if (
      !title ||
      !description ||
      !addresses ||
      !companyName ||
      !companyEmail ||
      !categoryId
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

    // Validate category
    const categoryExists = await prismaDB.Category.findUnique({
      where: { id: categoryId },
    });
    if (!categoryExists) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.NOT_FOUND,
        msg: "Selected category does not exist.",
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

    let finalShiftType = [];

    try {
      if (shiftType) {
        if (Array.isArray(shiftType)) {
          // Already an array
          finalShiftType = shiftType;
        } else if (typeof shiftType === "string") {
          // Try JSON.parse() first
          try {
            finalShiftType = JSON.parse(shiftType);
          } catch {
            // Fallback: comma-separated string → convert to array
            finalShiftType = shiftType.split(",").map((s) => s.trim());
          }
        }
      }
    } catch (err) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "Invalid shiftType format. Must be array or comma-separated string.",
      });
    }

    // Parse questionnaire safely
    let finalQuestionnaire = null;

    try {
      if (typeof questionnaire === "string") {
        const parsed = JSON.parse(questionnaire);
        finalQuestionnaire = Object.keys(parsed).length ? parsed : null;
      } else if (typeof questionnaire === "object" && questionnaire !== null) {
        finalQuestionnaire = Object.keys(questionnaire).length
          ? questionnaire
          : null;
      }
    } catch (err) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "Invalid questionnaire format. Must be JSON.",
      });
    }

    // Create Job + Addresses in one transaction
    const job = await prismaDB.Job.create({
      data: {
        title,
        description,
        requirements,
        responsibilities,
        education,
        minExperience: minExperience ? Number(minExperience) : 0,
        maxExperience: maxExperience ? Number(maxExperience) : 0,
        salaryType: availableSalaryType.includes(salaryType)
          ? salaryType
          : null,
        minSalary: minSalary ? Number(minSalary) : null,
        maxSalary: maxSalary ? Number(maxSalary) : null,
        shiftType: finalShiftType,
        questionnaire: finalQuestionnaire,
        mode,
        logoUrl,
        logoPreviewUrl,
        employmentType,
        companyName,
        companyEmail,
        categoryId,
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
      mode,
      employmentType,
      skillsRequired,
      openings,
      deadline,
      companyEmail,
      companyName,
      categoryId,
      isActive,
      minExperience,
      maxExperience,
      salaryType,
      minSalary,
      maxSalary,
      shiftType,
      questionnaire,
    } = req.body;
    const jobLogoFiles = req.files?.logoFiles || [];

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

    // Validate categoryId exists
    const categoryExists = await prismaDB.Category.findUnique({
      where: { id: categoryId },
    });
    if (!categoryExists) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.NOT_FOUND,
        msg: "Selected category does not exist.",
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

    // ---------- Parse shiftType ----------
    let finalShiftType = existingJob.shiftType || [];

    try {
      if (shiftType) {
        if (Array.isArray(shiftType)) {
          finalShiftType = shiftType;
        } else if (typeof shiftType === "string") {
          try {
            finalShiftType = JSON.parse(shiftType);
          } catch {
            finalShiftType = shiftType.split(",").map((s) => s.trim());
          }
        }
      }
    } catch {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "Invalid shiftType format",
      });
    }

    // ---------- Parse questionnaire ----------
    let finalQuestionnaire = existingJob.questionnaire || null;

    try {
      if (questionnaire) {
        if (typeof questionnaire === "string") {
          const parsed = JSON.parse(questionnaire);
          finalQuestionnaire = Object.keys(parsed).length ? parsed : null;
        } else if (typeof questionnaire === "object") {
          finalQuestionnaire = Object.keys(questionnaire).length
            ? questionnaire
            : null;
        }
      }
    } catch {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.BAD_REQUEST,
        msg: "Invalid questionnaire JSON",
      });
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
        companyEmail: companyEmail ?? existingJob.companyEmail,
        companyName: companyName ?? existingJob.companyName,
        mode: mode ?? existingJob.mode,
        employmentType: employmentType ?? existingJob.employmentType,
        minExperience:
          minExperience !== undefined
            ? Number(minExperience)
            : existingJob.minExperience,
        maxExperience:
          maxExperience !== undefined
            ? Number(maxExperience)
            : existingJob.maxExperience,
        salaryType: salaryType ?? existingJob.salaryType,
        minSalary:
          minSalary !== undefined ? Number(minSalary) : existingJob.minSalary,
        maxSalary:
          maxSalary !== undefined ? Number(maxSalary) : existingJob.maxSalary,
        shiftType: finalShiftType,
        questionnaire: finalQuestionnaire,
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
        categoryId: categoryId ?? existingJob.categoryId,
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
      categoryId,
      is_active,
    } = req.query;

    // Convert pagination params safely
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;
    const take = limitNum;

    // Convert is_active to Boolean if provided
    const isActiveBool =
      typeof is_active === "string"
        ? is_active.toLowerCase() === "true"
        : undefined;

    // ------------------ WHERE CONDITIONS ------------------
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
        categoryId ? { categoryId } : {},
        // Address filters
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
        category: true,
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

    if (!employeeIdBy) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.UNAUTHORIZED,
        msg: "Employee authentication missing.",
      });
    }

    console.log("EMPLOYEE OBJ ID:", req.employee_obj_id);
    console.log("EMPLOYEE DETAILS:", req.employeeDetails);

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

    const { questionnaireAnswers } = req.body;

    // STEP A — Validate questionnaire requirement
    const requiredQuestions = job.questionnaire
      ? Object.keys(job.questionnaire)
      : [];

    if (requiredQuestions.length > 0) {
      // Candidate must submit answers
      if (!questionnaireAnswers) {
        return actionFailedResponse({
          res,
          errorCode: responseFlags.PARAMETER_MISSING,
          msg: "Questionnaire answers are required for this job.",
        });
      }

      let parsedAnswers = questionnaireAnswers;

      // Parse if JSON string
      if (typeof questionnaireAnswers === "string") {
        try {
          parsedAnswers = JSON.parse(questionnaireAnswers);
        } catch {
          return actionFailedResponse({
            res,
            errorCode: responseFlags.BAD_REQUEST,
            msg: "Invalid questionnaireAnswers JSON format.",
          });
        }
      }

      // Validate user answered all required questions
      for (let q of requiredQuestions) {
        if (
          parsedAnswers[q] === undefined ||
          parsedAnswers[q] === null ||
          parsedAnswers[q] === ""
        ) {
          return actionFailedResponse({
            res,
            errorCode: responseFlags.PARAMETER_MISSING,
            msg: `Missing answer for required question: ${q}`,
          });
        }
      }

      // Save parsed object for DB
      req.finalQuestionnaireAnswers = parsedAnswers;
    } else {
      req.finalQuestionnaireAnswers = null; // No questions required
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
          questionnaireAnswers: req.finalQuestionnaireAnswers,
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
          questionnaireAnswers: req.finalQuestionnaireAnswers,
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
    const { applicationId, newStatus, reason, jobId } = req.body;
    const updatedBy = req.employeeDetails || req.superAdminDetails;

    // Validate required parameters
    if (!applicationId || !newStatus || !jobId) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.PARAMETER_MISSING,
        msg: responseMessages.PARAMETER_MISSING,
      });
    }

    // Find the application
    const application = await prismaDB.JobApplication.findUnique({
      where: { id: applicationId },
      include: {
        employee: {
          include: { user: true },
        },
        job: { include: { jobPostAddresses: true } },
      },
    });
    console.log("application", application);
    if (!application) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.NOT_FOUND,
        msg: "Job application not found",
      });
    }

    // Check jobId matches application's job
    if (application.jobId !== jobId) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.CONFLICT,
        msg: "This application does not belong to the provided job",
      });
    }

    // Check if the status is already the same
    if (application.status === newStatus) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.CONFLICT,
        msg: `Application already in status: ${newStatus}`,
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

    // OPTIONAL: Restrict updates to employer of that job
    if (
      req.employeeDetails &&
      application.job.employerId !== req.employeeDetails.id
    ) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.UNAUTHORIZED,
        msg: "You are not authorized to update this job’s applications",
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
        employee: { include: { user: true } },
        job: { include: { jobPostAddresses: true } },
      },
    });

    // Select message according to status
    const message =
      JobApplicationStatusMessages[newStatus] ||
      "Your job application status has been updated.";

    // Send email
    const emailResult = await sendApplicationStatusEmail({
      email: updatedApplication.employee.user.email,
      employeeFirstName: updatedApplication?.employee?.user?.firstName,
      employeeLastName: updatedApplication?.employee?.user?.lastName,
      status: newStatus,
      message,
      reason,
    });

    const msg = `Job application status updated to ${newStatus} and ${message}`;
    return actionCompleteResponse({
      res,
      msg,
      data: {
        emailSent: emailResult.success,
        emailMessage: message,
        updatedApplication,
      },
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
      status,
      appliedBy,
      employerId,
      categoryId,
      startDate,
      endDate,
      search,
      page,
      limit,
      sortBy = "appliedAt",
      order = "desc",
    } = req.query;

    const filters = { is_active: true };

    if (jobId) filters.jobId = jobId;
    if (employeeId) filters.employeeId = employeeId;
    if (status) filters.status = status;
    if (appliedBy) filters.appliedBy = appliedBy;
    if (employerId) {
      filters.job = {
        employerId: employerId,
      };
    }
    if (categoryId) {
      filters.job = {
        ...(filters.job || {}),
        categoryId: categoryId,
      };
    }

    // Date filter
    if (startDate || endDate) {
      filters.appliedAt = {};
      if (startDate) filters.appliedAt.gte = new Date(startDate);
      if (endDate) filters.appliedAt.lte = new Date(endDate);
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

    // Fetch from Job application
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
            category: true,
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
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
        jobApplications,
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
 * @desc Get All Job Apllication
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
      status,
      appliedBy,
      employerId,
      categoryId,
      startDate,
      endDate,
      search,
      page,
      limit,
      sortBy = "appliedAt",
      order = "desc",
    } = req.query;

    const filters = {};

    if (jobId) filters.jobId = jobId;
    if (employeeId) filters.employeeId = employeeId;
    if (status) filters.status = status;
    if (appliedBy) filters.appliedBy = appliedBy;
    if (employerId) {
      filters.job = {
        employerId: employerId,
      };
    }
    if (categoryId) {
      filters.job = {
        ...(filters.job || {}),
        categoryId: categoryId,
      };
    }

    // Date filter
    if (startDate || endDate) {
      filters.appliedAt = {};
      if (startDate) filters.appliedAt.gte = new Date(startDate);
      if (endDate) filters.appliedAt.lte = new Date(endDate);
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
            category: true,
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
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
        jobApplications,
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
 * @desc Save Job, Candidate, Job Apllication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @return {Object} JSON response with success or error message
 * @route POST /api/v1/job/common/saved-details/:type/:id
 * @access ALL ROLES
 */
export const savedDetails = async (req, res) => {
  try {
    const { type, id: value } = req.params;
    const userId =
      req?.employee_obj_id || req?.employer_obj_id || req?.superAdmin_obj_id;
    const savedBy =
      req.employeeDetails || req.employerDetails || req.superAdminDetails;

    if (!userId) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.PARAMETER_MISSING,
        msg: "User not found.",
      });
    }

    // Validate type
    if (!availableSaveViewType.includes(type)) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.PARAMETER_MISSING,
        msg: "Invalid type. Must be JOB, CANDIDATE or JOB_APPLICATION.",
      });
    }

    // Validate entity exists
    if (type === SaveViewType.JOB) {
      const job = await prismaDB.Job.findUnique({ where: { id: value } });
      if (!job) {
        return actionFailedResponse({
          res,
          errorCode: responseFlags.NOT_FOUND,
          msg: "Job not found.",
        });
      }
    }

    if (type === SaveViewType.CANDIDATE) {
      const candidate = await prismaDB.User.findUnique({
        where: { id: value },
      });
      if (!candidate) {
        return actionFailedResponse({
          res,
          errorCode: responseFlags.NOT_FOUND,
          msg: "Candidate not found.",
        });
      }
    }

    if (type === SaveViewType.JOB_APPLICATION) {
      const application = await prismaDB.JobApplication.findUnique({
        where: { id: value },
      });
      if (!application) {
        return actionFailedResponse({
          res,
          errorCode: responseFlags.NOT_FOUND,
          msg: "Application not found.",
        });
      }
    }

    // Check existing record
    const existing = await prismaDB.SavedDetails.findFirst({
      where: { userId, type, value },
    });

    // If exists and active => UNSAVE
    if (existing && existing.is_active) {
      const updated = await prismaDB.SavedDetails.update({
        where: { id: existing.id },
        data: { is_active: false },
      });

      return actionCompleteResponse({
        res,
        msg: `${type} unsaved successfully.`,
        data: { updated },
      });
    }

    // If exists but inactive => RESAVE
    if (existing && !existing.is_active) {
      const updated = await prismaDB.SavedDetails.update({
        where: { id: existing.id },
        data: { is_active: true },
      });

      return actionCompleteResponse({
        res,
        msg: `Again ${type} saved successfully.`,
        data: { updated },
      });
    }

    // Create new entry
    const saved = await prismaDB.SavedDetails.create({
      data: {
        userId,
        type,
        value,
        savedBy,
        is_active: true,
      },
    });

    return actionCompleteResponse({
      res,
      msg: `${type} saved successfully.`,
      data: { saved },
    });
  } catch (error) {
    console.error("Error saving details:", error);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      msg: error.message || "Error performing save/unsave",
    });
  }
};

/**
 * @desc View Job, Candidate, Job Apllication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @return {Object} JSON response with success or error message
 * @route POST /api/v1/job/common/viewed-details/:type/:id
 * @access ALL ROLES
 */
export const viewedDetails = async (req, res) => {
  try {
    const { type, id: value } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.PARAMETER_MISSING,
        msg: "User not found.",
      });
    }

    // Validate type
    const validTypes = ["JOB", "CANDIDATE", "APPLICATION"];
    if (!validTypes.includes(type)) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.PARAMETER_MISSING,
        msg: "Invalid type. Must be JOB, CANDIDATE or APPLICATION.",
      });
    }

    // Validate entity exists
    if (type === "JOB") {
      const job = await prismaDB.Job.findUnique({ where: { id: value } });
      if (!job) {
        return actionFailedResponse({
          res,
          errorCode: responseFlags.NOT_FOUND,
          msg: "Job not found.",
        });
      }
    }

    if (type === "CANDIDATE") {
      const candidate = await prismaDB.User.findUnique({
        where: { id: value },
      });
      if (!candidate) {
        return actionFailedResponse({
          res,
          errorCode: responseFlags.NOT_FOUND,
          msg: "Candidate not found.",
        });
      }
    }

    if (type === "APPLICATION") {
      const application = await prismaDB.JobApplication.findUnique({
        where: { id: value },
      });
      if (!application) {
        return actionFailedResponse({
          res,
          errorCode: responseFlags.NOT_FOUND,
          msg: "Application not found.",
        });
      }
    }

    // Create view log
    const viewLog = await prismaDB.ViewedDetails.create({
      data: {
        userId,
        viewedBy: userId,
        type,
        value,
      },
    });

    return actionCompleteResponse({
      res,
      msg: `${type} viewed successfully.`,
      data: viewLog,
    });
  } catch (error) {
    console.error("Error viewing details:", error);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      msg: error.message || "Error viewing entity",
    });
  }
};

export const toggleSaveApplication = async (req, res) => {
  try {
    const { applicationId, action } = req.params;
    const userId = req.user?.id;

    if (!applicationId || !userId || !action) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.PARAMETER_MISSING,
        msg: responseMessages.PARAMETER_MISSING,
      });
    }

    // Check application exists
    const application = await prismaDB.jobApplication.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.NOT_FOUND,
        msg: "Application not found.",
      });
    }

    // Check current saved entry
    const existing = await prismaDB.savedApplication.findFirst({
      where: { userId, applicationId },
    });

    // -----------------------------
    // SAVE LOGIC
    // -----------------------------
    if (action === "save") {
      if (existing && existing.is_active) {
        return actionCompleteResponse({
          res,
          msg: "Application already saved.",
          data: existing,
        });
      }

      if (existing && !existing.is_active) {
        const updated = await prismaDB.savedApplication.update({
          where: { id: existing.id },
          data: { is_active: true },
        });

        return actionCompleteResponse({
          res,
          msg: "Application saved again.",
          data: updated,
        });
      }

      const newSave = await prismaDB.savedApplication.create({
        data: {
          userId,
          applicationId,
          savedBy: userId,
        },
      });

      return actionCompleteResponse({
        res,
        msg: "Application saved successfully.",
        data: newSave,
      });
    }

    // -----------------------------
    // UNSAVE LOGIC
    // -----------------------------
    if (action === "unsave") {
      if (!existing) {
        return actionFailedResponse({
          res,
          errorCode: responseFlags.NOT_FOUND,
          msg: "Saved application not found.",
        });
      }

      if (!existing.is_active) {
        return actionCompleteResponse({
          res,
          msg: "Application already unsaved.",
          data: existing,
        });
      }

      const updated = await prismaDB.savedApplication.update({
        where: { id: existing.id },
        data: { is_active: false },
      });

      return actionCompleteResponse({
        res,
        msg: "Application unsaved successfully.",
        data: updated,
      });
    }

    // Invalid action
    return actionFailedResponse({
      res,
      errorCode: responseFlags.INVALID_ACTION,
      msg: "Invalid action. Use 'save' or 'unsave'.",
    });
  } catch (error) {
    console.error("Error in toggleSaveApplication:", error);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      msg: error.message || "Error saving/unsaving application",
    });
  }
};

export const viewApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!applicationId || !userId) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.PARAMETER_MISSING,
        msg: responseMessages.PARAMETER_MISSING,
      });
    }

    // Fetch application
    const application = await prismaDB.jobApplication.findUnique({
      where: { id: applicationId },
      include: {
        employee: {
          include: { user: true },
        },
      },
    });

    if (!application) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.NOT_FOUND,
        msg: "Application not found.",
      });
    }

    // EMPLOYEE can only view his own application
    if (role === "EMPLOYEE" && application.employee.userId !== userId) {
      return actionFailedResponse({
        res,
        errorCode: responseFlags.UNAUTHORIZED,
        msg: "You cannot view another user's application.",
      });
    }

    // Everyone else (Employer, Admin, SuperAdmin) can view

    // Log the view
    const viewLog = await prismaDB.viewedApplication.create({
      data: {
        userId,
        applicationId,
        viewedBy: userId,
      },
    });

    return actionCompleteResponse({
      res,
      msg: "Application viewed successfully.",
      data: {
        application,
        viewLog,
      },
    });
  } catch (error) {
    console.error("Error viewing application:", error);
    return actionFailedResponse({
      res,
      errorCode: responseFlags.ACTION_FAILED,
      msg: error.message || "Error viewing application",
    });
  }
};
