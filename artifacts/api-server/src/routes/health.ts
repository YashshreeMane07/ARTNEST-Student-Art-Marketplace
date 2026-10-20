import { Router, type IRouter } from "express";
import mongoose from "mongoose";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const database = mongoose.connection.readyState === 1;
  res.status(database ? 200 : 503).json({
    status: database ? "ok" : "not_ready",
    services: {
      database,
      firebaseAdmin: Boolean(
        process.env.FIREBASE_PROJECT_ID &&
          process.env.FIREBASE_CLIENT_EMAIL &&
          process.env.FIREBASE_PRIVATE_KEY,
      ),
      cloudinary: Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
          process.env.CLOUDINARY_API_KEY &&
          process.env.CLOUDINARY_API_SECRET,
      ),
      gemini: Boolean(process.env.GEMINI_API_KEY),
    },
  });
});

export default router;
