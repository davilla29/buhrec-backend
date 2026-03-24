import streamifier from "streamifier";
import { cloudinary } from "../config/cloudinary.js";

export function uploadBufferToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
}

export function deleteFromCloudinary(publicId) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(
      publicId,
      { resource_type: "image" },
      (error, result) => {
        // If not found as image, attempt to delete as 'raw' (used for DOC/DOCX)
        if (result && result.result === "not found") {
          cloudinary.uploader.destroy(
            publicId,
            { resource_type: "raw" },
            (err2, res2) => {
              if (err2) return reject(err2);
              resolve(res2);
            },
          );
        } else {
          if (error) return reject(error);
          resolve(result);
        }
      },
    );
  });
}
