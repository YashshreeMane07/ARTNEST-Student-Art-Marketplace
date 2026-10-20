import { Router } from "express";
import { currentUser, requireAuth, requireRole } from "../middlewares/auth";
import { httpError } from "../middlewares/errors";
import { imageUpload } from "../middlewares/upload";
import { Artwork, Follow, Review, User, Wishlist } from "../models";
import { deleteImage, uploadImage } from "../services/cloudinary";
import {
  notify,
  pageOptions,
  publicArtwork,
  publicCreator,
  requireCreator,
  safePattern,
  stringList,
  text,
} from "./helpers";

const router = Router();

router.get("/artworks", async (req, res) => {
  const { page, limit, skip } = pageOptions(req);
  const query: Record<string, unknown> = { status: "PUBLISHED" };
  const q = text(req.query.q, 100);
  const category = text(req.query.category, 80);
  const creatorId = text(req.query.creatorId, 100);
  const tag = text(req.query.tag, 60);
  const minPrice = Number(req.query.minPrice);
  const maxPrice = Number(req.query.maxPrice);
  if (category && category !== "All categories") query.category = safePattern(category);
  if (creatorId) query.creatorId = creatorId;
  if (tag) query.tags = safePattern(tag);
  if (Number.isFinite(minPrice) || Number.isFinite(maxPrice)) {
    query.price = {
      ...(Number.isFinite(minPrice) ? { $gte: minPrice } : {}),
      ...(Number.isFinite(maxPrice) ? { $lte: maxPrice } : {}),
    };
  }
  if (q) {
    const pattern = safePattern(q);
    const creators = await User.find({
      role: "student_creator",
      $or: [{ name: pattern }, { skills: pattern }],
    })
      .select("_id")
      .lean();
    query.$or = [
      { title: pattern },
      { description: pattern },
      { tags: pattern },
      { category: pattern },
      ...(creators.length ? [{ creatorId: { $in: creators.map((creator) => creator._id) } }] : []),
    ];
  }

  const sort = String(req.query.sort || "newest");
  const sortBy: Record<string, 1 | -1> =
    sort === "popular"
      ? { likes: -1, views: -1, createdAt: -1 }
      : sort === "trending"
        ? { likes: -1, views: -1, createdAt: -1 }
        : { createdAt: -1 };
  const [artworks, total] = await Promise.all([
    Artwork.find(query).sort(sortBy).skip(skip).limit(limit).lean(),
    Artwork.countDocuments(query),
  ]);
  res.json({
    artworks: artworks.map(publicArtwork),
    page,
    limit,
    total,
    hasMore: skip + artworks.length < total,
  });
});

router.get("/artworks/mine", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const artworks = await Artwork.find({ creatorId: user.id }).sort({ updatedAt: -1 }).lean();
  res.json({ artworks: artworks.map(publicArtwork) });
});

router.get("/likes", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const artworks = await Artwork.find({ likedBy: user.id, status: "PUBLISHED" }).select("_id").lean();
  res.json({ artworkIds: artworks.map((artwork) => artwork._id) });
});

router.get("/following", requireAuth, async (req, res) => {
  const follows = await Follow.find({ followerId: currentUser(req).id }).select("followingId").lean();
  res.json({ creatorIds: follows.map((follow) => follow.followingId) });
});

router.get("/artworks/:id", async (req, res) => {
  const artwork = await Artwork.findOneAndUpdate(
    { _id: req.params.id, status: "PUBLISHED" },
    { $inc: { views: 1 } },
    { new: true },
  );
  if (!artwork) throw httpError(404, "ARTWORK_NOT_FOUND", "This artwork is not available.");
  await User.updateOne({ _id: artwork.creatorId }, { $inc: { totalViews: 1 } });
  res.json({ artwork: publicArtwork(artwork) });
});

router.post(
  "/artworks",
  requireAuth,
  requireRole("student_creator", "admin"),
  imageUpload.single("image"),
  async (req, res) => {
    await requireCreator(currentUser(req).id);
    if (!req.file) throw httpError(400, "IMAGE_REQUIRED", "Choose an artwork image before publishing.");
    const title = text(req.body?.title, 120);
    const description = text(req.body?.description, 4000);
    const category = text(req.body?.category, 80);
    const price = Number(req.body?.price);
    if (!title || !description || !category || !Number.isFinite(price) || price < 0 || price > 1000000) {
      throw httpError(400, "INVALID_ARTWORK", "Provide a title, description, category, and valid price.");
    }
    const uploaded = await uploadImage(req.file.buffer, "artnest/artworks");
    const artwork = await Artwork.create({
      creatorId: currentUser(req).id,
      title,
      description,
      category,
      style: text(req.body?.style, 80),
      tags: stringList(req.body?.tags),
      keywords: stringList(req.body?.keywords, 20),
      price,
      imageUrl: uploaded.url,
      imagePublicId: uploaded.publicId,
      status: req.body?.status === "DRAFT" ? "DRAFT" : "PUBLISHED",
    });
    res.status(201).json({ artwork: publicArtwork(artwork) });
  },
);

router.put(
  "/artworks/:id",
  requireAuth,
  imageUpload.single("image"),
  async (req, res) => {
    const user = currentUser(req);
    const artwork = await Artwork.findById(req.params.id);
    if (!artwork) throw httpError(404, "ARTWORK_NOT_FOUND", "This artwork is not available.");
    if (artwork.creatorId !== user.id && user.role !== "admin") {
      throw httpError(403, "NOT_OWNER", "You can only edit your own artwork.");
    }
    const body = req.body as Record<string, unknown>;
    const allowed = ["title", "description", "category", "style", "price", "tags", "keywords", "status"];
    for (const field of allowed) {
      if (body[field] === undefined) continue;
      if (field === "tags" || field === "keywords") {
        artwork[field] = stringList(body[field], field === "tags" ? 15 : 20);
      } else if (field === "price") {
        const price = Number(body.price);
        if (!Number.isFinite(price) || price < 0 || price > 1000000) {
          throw httpError(400, "INVALID_PRICE", "Enter a valid artwork price.");
        }
        artwork.price = price;
      } else if (field === "status") {
        if (!["DRAFT", "PUBLISHED"].includes(String(body.status))) {
          throw httpError(400, "INVALID_STATUS", "Artwork status must be draft or published.");
        }
        artwork.status = String(body.status);
      } else {
        (artwork as any)[field] = text(body[field], field === "description" ? 4000 : field === "title" ? 120 : 80);
      }
    }
    if (req.file) {
      const uploaded = await uploadImage(req.file.buffer, "artnest/artworks");
      if (artwork.imagePublicId) await deleteImage(artwork.imagePublicId).catch(() => undefined);
      artwork.imageUrl = uploaded.url;
      artwork.imagePublicId = uploaded.publicId;
    }
    await artwork.save();
    res.json({ artwork: publicArtwork(artwork) });
  },
);

router.delete("/artworks/:id", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const artwork = await Artwork.findById(req.params.id);
  if (!artwork) throw httpError(404, "ARTWORK_NOT_FOUND", "This artwork is not available.");
  if (artwork.creatorId !== user.id && user.role !== "admin") {
    throw httpError(403, "NOT_OWNER", "You can only delete your own artwork.");
  }
  if (artwork.imagePublicId) await deleteImage(artwork.imagePublicId);
  await Promise.all([
    artwork.deleteOne(),
    Wishlist.updateMany({ artworkIds: artwork._id }, { $pull: { artworkIds: artwork._id } }),
  ]);
  res.status(204).end();
});

router.post("/artworks/:id/like", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const artwork = await Artwork.findById(req.params.id).select("+likedBy");
  if (!artwork || artwork.status !== "PUBLISHED") {
    throw httpError(404, "ARTWORK_NOT_FOUND", "This artwork is not available.");
  }
  const alreadyLiked = artwork.likedBy.includes(user.id);
  if (alreadyLiked) {
    artwork.likedBy.pull(user.id);
    artwork.likes = Math.max(0, artwork.likes - 1);
  } else {
    artwork.likedBy.addToSet(user.id);
    artwork.likes += 1;
    if (artwork.creatorId !== user.id) {
      await notify(artwork.creatorId, "like", "Someone liked your artwork", `${user.name} liked ${artwork.title}.`, {
        artworkId: artwork._id,
      });
    }
  }
  await artwork.save();
  res.json({ liked: !alreadyLiked, likes: artwork.likes });
});

router.get("/creators", async (req, res) => {
  const q = text(req.query.q, 100);
  const filter: Record<string, unknown> = { role: "student_creator" };
  if (req.query.college) filter.college = safePattern(text(req.query.college, 160));
  if (req.query.skill) filter.skills = safePattern(text(req.query.skill, 60));
  if (req.query.location) filter.location = safePattern(text(req.query.location, 120));
  if (q) {
    const pattern = safePattern(q);
    filter.$or = [{ name: pattern }, { college: pattern }, { skills: pattern }, { bio: pattern }];
  }
  const users = await User.find(filter).sort({ followers: -1, createdAt: -1 }).limit(80).lean();
  const ids = users.map((user) => user._id);
  const counts = await Artwork.aggregate([
    { $match: { creatorId: { $in: ids }, status: "PUBLISHED" } },
    { $group: { _id: "$creatorId", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((item) => [item._id, item.count]));
  res.json({
    creators: users.map((user) => publicCreator(user, countMap.get(user._id) || 0)),
  });
});

router.get("/creators/:id", async (req, res) => {
  const user = await User.findById(req.params.id).lean();
  if (!user || user.role !== "student_creator") throw httpError(404, "CREATOR_NOT_FOUND", "Creator not found.");
  const [works, artworks, reviews, followerCount] = await Promise.all([
    Artwork.countDocuments({ creatorId: user._id, status: "PUBLISHED" }),
    Artwork.find({ creatorId: user._id, status: "PUBLISHED" }).sort({ createdAt: -1 }).limit(24).lean(),
    Review.find({ creatorId: user._id }).sort({ createdAt: -1 }).limit(30).lean(),
    Follow.countDocuments({ followingId: user._id }),
  ]);
  res.json({
    creator: publicCreator({ ...user, followers: followerCount }, works),
    artworks: artworks.map(publicArtwork),
    reviews,
  });
});

router.post("/creators/:id/follow", requireAuth, async (req, res) => {
  const user = currentUser(req);
  if (user.id === req.params.id) throw httpError(400, "CANNOT_FOLLOW_SELF", "You cannot follow your own profile.");
  const target = await User.findById(req.params.id);
  if (!target || target.role !== "student_creator") throw httpError(404, "CREATOR_NOT_FOUND", "Creator not found.");
  const existing = await Follow.findOne({ followerId: user.id, followingId: target._id });
  if (existing) {
    await existing.deleteOne();
    target.followers = Math.max(0, target.followers - 1);
    await target.save();
    res.json({ following: false, followers: target.followers });
    return;
  }
  await Follow.create({ followerId: user.id, followingId: target._id });
  target.followers += 1;
  await target.save();
  await notify(target._id, "follow", "A new follower", `${user.name} started following you.`);
  res.json({ following: true, followers: target.followers });
});

router.get("/creators/:id/following", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const following = await Follow.exists({ followerId: user.id, followingId: req.params.id });
  res.json({ following: Boolean(following) });
});

export default router;
