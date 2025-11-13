import path from "path";
import { uploadToCloudinary } from "./cloudinaryCloudStorage.js";
import { v2 as cloudinary } from "cloudinary";

/**
 * Processes uploaded files and returns arrays of public URLs, preview URLs, and filenames.
 * @param {Array} files - Array of uploaded files (from req.files).
 * @param {String} email - The category name used in the filename.
 * @returns {{ imageUrlsArray: string[], previewUrlsArray: string[], fileNamesArray: string[] }}
 */
export const processUploadedFiles = async (files, folderName, email) => {
  const imageUrlsArray = [];
  const previewUrlsArray = [];

  if (files && Array.isArray(files)) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const extension = path.extname(file.originalname).slice(1);
      const fileName = `${email}_${i + 1}.${extension}`;
      const filePath = `JOBPOLODATA/${folderName}/${fileName}`;
      console.log("filePath", filePath);

      // Upload to Cloudinary
      const { publicLink, previewLink } = await uploadToCloudinary(
        filePath,
        file
      );

      imageUrlsArray.push(publicLink);
      previewUrlsArray.push(previewLink);
    }
  }

  return { imageUrlsArray, previewUrlsArray };
};

/**
 * Handles file update:
 * - Deletes old file from Cloudinary
 * - Uploads new file(s)
 * - Returns updated file URLs
 *
 * @param {string|null} oldUrl - Old Cloudinary URL
 * @param {Array} newFiles - New uploaded files
 * @param {string} folderName - Folder inside Cloudinary
 * @param {string} filePrefix - Prefix for naming (categoryName, email etc.)
 * @returns {{ publicUrl: string|null, previewUrl: string|null }}
 */
export const updateFileHelper = async (
  oldUrl,
  newFiles,
  folderName,
  filePrefix
) => {
  let publicUrl = oldUrl;
  let previewUrl = oldUrl;

  try {
    // 1 Delete old image if exists
    if (oldUrl) {
      try {
        const fileName = oldUrl.split("/").pop();
        const publicId = fileName.split(".")[0];

        await cloudinary.uploader.destroy(
          `JOBPOLODATA/${folderName}/${publicId}`
        );
      } catch (err) {
        console.error("Old file delete failed:", err);
      }
    }

    // 2 Upload new file (if provided)
    if (newFiles && newFiles.length > 0) {
      const file = newFiles[0];
      const extension = path.extname(file.originalname).slice(1);
      const newFileName = `${filePrefix}_${Date.now()}.${extension}`;

      const filePath = `JOBPOLODATA/${folderName}/${newFileName}`;

      const { publicLink, previewLink } = await uploadToCloudinary(
        filePath,
        file
      );

      publicUrl = publicLink;
      previewUrl = previewLink;
    }

    return { publicUrl, previewUrl };
  } catch (error) {
    console.error("File update helper error:", error);
    return { publicUrl: oldUrl, previewUrl: oldUrl };
  }
};
