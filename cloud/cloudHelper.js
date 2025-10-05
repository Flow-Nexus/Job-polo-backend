import path from "path";
import { uploadToCloudinary } from "./cloudStorage.js";

/**
 * Processes uploaded files and returns arrays of public URLs, preview URLs, and filenames.
 * @param {Array} files - Array of uploaded files (from req.files).
 * @param {String} name - The category name used in the filename.
 * @returns {{ imageUrlsArray: string[], previewUrlsArray: string[], fileNamesArray: string[] }}
 */
export const processUploadedFiles = async (files, name, folderName) => {
  const imageUrlsArray = [];
  const previewUrlsArray = [];

  if (files && Array.isArray(files)) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const extension = path.extname(file.originalname).slice(1);
      const fileName = `${name}_${i + 1}.${extension}`;
      const filePath = `JOBPOLODATA/${folderName}/${fileName}`;

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
