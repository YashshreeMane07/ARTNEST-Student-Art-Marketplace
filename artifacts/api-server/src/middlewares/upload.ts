import multer from "multer";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) {
      callback(new Error("Upload a JPEG, PNG, WebP, or GIF image."));
      return;
    }
    callback(null, true);
  },
});
