import mongoose from "mongoose";
import { logger } from "../lib/logger";

export async function connectMongo(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is required. Add a MongoDB Atlas driver URI in Replit Secrets.");
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 12000,
      connectTimeoutMS: 12000,
      autoIndex: process.env.NODE_ENV !== "production",
      appName: "ARTNEST",
    });
    logger.info("Connected to MongoDB");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown connection error";
    logger.error(
      { message: message.split(uri).join("[redacted MongoDB URI]") },
      "MongoDB connection failed",
    );
    throw new Error(
      "MongoDB connection failed. Check the Atlas URI, database user password, and Atlas Network Access allowlist.",
    );
  }
}
