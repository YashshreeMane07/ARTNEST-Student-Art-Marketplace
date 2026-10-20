import { v2 as cloudinary } from "cloudinary";

let configured = false;

function configureCloudinary() {
  if (configured) return;
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  const missing = [
    !CLOUDINARY_CLOUD_NAME && "CLOUDINARY_CLOUD_NAME",
    !CLOUDINARY_API_KEY && "CLOUDINARY_API_KEY",
    !CLOUDINARY_API_SECRET && "CLOUDINARY_API_SECRET",
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(`Cloudinary configuration is missing: ${missing.join(", ")}`);
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
  configured = true;
}

export async function uploadImage(
  buffer: Buffer,
  folder: "artnest/artworks" | "artnest/profiles" | "artnest/portfolio" | "artnest/verification",
) {
  configureCloudinary();
  return new Promise<{ url: string; publicId: string }>((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image", overwrite: false },
      (error, result) => {
        if (error || !result) {
          reject(new Error("Cloudinary image upload failed."));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    upload.end(buffer);
  });
}

export async function deleteImage(publicId: string): Promise<void> {
  if (!publicId) return;
  configureCloudinary();
  await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
}
