import { Router } from "express";
import rateLimit from "express-rate-limit";
import { currentUser, requireAuth, requireRole } from "../middlewares/auth";
import { httpError } from "../middlewares/errors";
import { imageUpload } from "../middlewares/upload";
import { Artwork, User } from "../models";
import { suggestArtworkMetadata } from "../services/gemini";
import { safePattern, text } from "./helpers";

const router = Router();
const aiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

router.post(
  "/ai/artwork-suggestions",
  aiLimiter,
  requireAuth,
  requireRole("student_creator", "admin"),
  imageUpload.single("image"),
  async (req, res) => {
    const user = currentUser(req);
    const image = req.file;
    try {
      const suggestions = await suggestArtworkMetadata({
        title: text(req.body?.title, 120),
        description: text(req.body?.description, 2000),
        category: text(req.body?.category, 80),
        image: image?.buffer,
        mimeType: image?.mimetype,
      });
      res.json({ suggestions, requiresCreatorReview: true });
    } catch {
      throw httpError(502, "AI_UNAVAILABLE", "Gemini could not create suggestions. Please try again.");
    }
  },
);

router.post("/ai/discover", aiLimiter, async (req, res) => {
  const query = text(req.body?.query, 100);
  if (query.length < 2) throw httpError(400, "QUERY_TOO_SHORT", "Enter at least two characters to search.");
  const pattern = safePattern(query);
  const creators = await User.find({
    role: "student_creator",
    $or: [{ name: pattern }, { skills: pattern }],
  })
    .select("_id")
    .limit(30)
    .lean();
  const artworks = await Artwork.find({
    status: "PUBLISHED",
    $or: [
      { title: pattern },
      { description: pattern },
      { tags: pattern },
      { keywords: pattern },
      { category: pattern },
      { creatorId: { $in: creators.map((creator) => creator._id) } },
    ],
  })
    .sort({ likes: -1, views: -1 })
    .limit(30)
    .lean();
  res.json({ artworks, query, mode: "keyword-discovery" });
});

export default router;
