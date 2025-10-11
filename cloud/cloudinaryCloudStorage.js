import axios from "axios";
import multer from "multer";
import path from "path";
import { v2 as cloudinary } from "cloudinary";

// Multer setup to use memory storage
const storage = multer.memoryStorage();
export const upload = multer({ storage });

// ---------------- Cloudinary Config ----------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_APIKEY,
  api_secret: process.env.CLOUDINARY_SECRETKEY,
});

/**
 * Upload file to Cloudinary and generate public + preview links
 * @param {string} folderPath - Folder path in Cloudinary (e.g., "users/123")
 * @param {object} file - Multer file object
 * @returns {object} - { publicLink, previewLink }
 */
export const uploadToCloudinary = async (folderPath, file) => {
  if (!file || !file.buffer) {
    throw new Error("No file provided for upload.");
  }

  const streamUpload = () =>
    new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: folderPath,
          resource_type: "auto",
          use_filename: true,
          unique_filename: false,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      stream.end(file.buffer);
    });

  const uploadResult = await streamUpload();

  return {
    publicLink: uploadResult.secure_url,
    previewLink: uploadResult.secure_url,
  };
};


