import { Router } from "express";
import { currentUser, requireAuth, requireRole } from "../middlewares/auth";
import { httpError } from "../middlewares/errors";
import {
  Artwork,
  Collaboration,
  Commission,
  Follow,
  Notification,
  Order,
  PortfolioProject,
  Report,
  User,
  Verification,
} from "../models";
import { deleteImage } from "../services/cloudinary";
import { notify } from "./helpers";

const router = Router();

router.get("/dashboard", requireAuth, requireRole("student_creator", "admin"), async (req, res) => {
  const creatorId = currentUser(req).id;
  const [artworks, followers, orders, commissions, notifications, portfolio, collaborations] = await Promise.all([
    Artwork.find({ creatorId, status: { $ne: "REMOVED" } }).select("views likes").lean(),
    Follow.countDocuments({ followingId: creatorId }),
    Order.find({ "items.creatorId": creatorId, paymentStatus: "PAID" }).select("items amount createdAt orderStatus").lean(),
    Commission.find({ creatorId }).select("status title createdAt").sort({ createdAt: -1 }).limit(20).lean(),
    Notification.find({ userId: creatorId }).sort({ createdAt: -1 }).limit(8).lean(),
    PortfolioProject.countDocuments({ creatorId }),
    Collaboration.countDocuments({ creatorId, status: { $in: ["OPEN", "IN_PROGRESS"] } }),
  ]);
  const totalViews = artworks.reduce((sum, art) => sum + (art.views || 0), 0);
  const totalLikes = artworks.reduce((sum, art) => sum + (art.likes || 0), 0);
  const sales = orders.reduce(
    (sum, order) =>
      sum +
      order.items
        .filter((item: any) => item.creatorId === creatorId)
        .reduce((lineSum: number, item: any) => lineSum + item.quantity, 0),
    0,
  );
  const gross = orders.reduce(
    (sum, order) =>
      sum +
      order.items
        .filter((item: any) => item.creatorId === creatorId)
        .reduce((lineSum: number, item: any) => lineSum + item.unitPrice * item.quantity, 0),
    0,
  );
  const pendingCommissions = commissions.filter((item) => item.status === "PENDING").length;
  const completedCommissions = commissions.filter((item) => item.status === "COMPLETED").length;
  const monthly = Array.from({ length: 6 }, (_, offset) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - offset), 1);
    return {
      label: date.toLocaleString("en", { month: "short" }),
      views: 0,
      likes: 0,
      sales: 0,
    };
  });
  const since = new Date();
  since.setMonth(since.getMonth() - 5, 1);
  const recentArts = await Artwork.find({ creatorId, createdAt: { $gte: since } }).select("views likes createdAt").lean();
  for (const art of recentArts) {
    const date = new Date(art.createdAt);
    const index = Math.max(0, Math.min(5, (date.getFullYear() - since.getFullYear()) * 12 + date.getMonth() - since.getMonth()));
    monthly[index].views += art.views || 0;
    monthly[index].likes += art.likes || 0;
  }
  for (const order of orders) {
    const date = new Date(order.createdAt);
    if (date < since) continue;
    const index = Math.max(0, Math.min(5, (date.getFullYear() - since.getFullYear()) * 12 + date.getMonth() - since.getMonth()));
    monthly[index].sales += order.items
      .filter((item: any) => item.creatorId === creatorId)
      .reduce((count: number, item: any) => count + item.quantity, 0);
  }
  res.json({
    stats: {
      totalArtworks: artworks.length,
      views: totalViews,
      likes: totalLikes,
      followers,
      sales,
      earnings: Math.round(gross * 0.955),
      paidOrders: orders.length,
      pendingCommissions,
      completedCommissions,
      portfolioProjects: portfolio,
      activeCollaborations: collaborations,
    },
    monthly,
    recentActivity: notifications,
    recentCommissions: commissions.slice(0, 6),
  });
});

router.get("/admin/stats", requireAuth, requireRole("admin"), async (_req, res) => {
  const [users, creators, artworks, pendingVerifications, orders, commissions, reports] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: "student_creator" }),
    Artwork.countDocuments({ status: "PUBLISHED" }),
    Verification.countDocuments({ status: "PENDING" }),
    Order.countDocuments({ paymentStatus: "PAID" }),
    Commission.countDocuments(),
    Report.countDocuments({ status: "OPEN" }),
  ]);
  const paid = await Order.aggregate([
    { $match: { paymentStatus: "PAID" } },
    { $group: { _id: null, gross: { $sum: "$amount" } } },
  ]);
  res.json({
    stats: {
      users,
      creators,
      artworks,
      pendingVerifications,
      paidOrders: orders,
      commissions,
      openReports: reports,
      paidGross: paid[0]?.gross || 0,
    },
  });
});

router.get("/admin/users", requireAuth, requireRole("admin"), async (req, res) => {
  const role = req.query.role ? String(req.query.role) : "";
  const filter: Record<string, unknown> = {};
  if (["buyer", "student_creator", "admin"].includes(role)) filter.role = role;
  const users = await User.find(filter)
    .select("-firebaseUid -verifiedStudentEmail -__v")
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  res.json({ users });
});

router.get("/admin/verifications", requireAuth, requireRole("admin"), async (_req, res) => {
  const verifications = await Verification.find({ status: "PENDING" })
    .sort({ createdAt: 1 })
    .populate("userId", "name email college course profileImage")
    .lean();
  res.json({ verifications });
});

router.patch("/admin/verifications/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const admin = currentUser(req);
  const status = String(req.body?.status || "").toUpperCase();
  if (!["VERIFIED", "REJECTED"].includes(status)) {
    throw httpError(400, "INVALID_VERIFICATION_STATUS", "Choose VERIFIED or REJECTED.");
  }
  const verification = await Verification.findById(req.params.id);
  if (!verification) throw httpError(404, "VERIFICATION_NOT_FOUND", "Verification request not found.");
  verification.status = status;
  verification.reviewedBy = admin.id;
  verification.reviewedAt = new Date();
  verification.adminNote = String(req.body?.adminNote || "").trim().slice(0, 500);
  await verification.save();
  await User.updateOne(
    { _id: verification.userId },
    {
      $set: {
        verificationStatus: status,
        verificationReviewedAt: verification.reviewedAt,
        verificationNote: verification.adminNote,
      },
    },
  );
  await notify(
    verification.userId,
    "verification",
    status === "VERIFIED" ? "Student verification approved" : "Student verification update",
    status === "VERIFIED"
      ? "Your student creator profile is now verified."
      : "Your verification request was not approved. Review the note and submit again.",
  );
  res.json({ verification });
});

router.get("/admin/artworks", requireAuth, requireRole("admin"), async (req, res) => {
  const status = String(req.query.status || "PUBLISHED").toUpperCase();
  const artworks = await Artwork.find({ status }).sort({ createdAt: -1 }).limit(200).lean();
  res.json({ artworks });
});

router.delete("/admin/artworks/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const artwork = await Artwork.findById(req.params.id);
  if (!artwork) throw httpError(404, "ARTWORK_NOT_FOUND", "Artwork not found.");
  if (artwork.imagePublicId) await deleteImage(artwork.imagePublicId);
  artwork.status = "REMOVED";
  await artwork.save();
  res.json({ removed: true });
});

router.get("/admin/orders", requireAuth, requireRole("admin"), async (_req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 }).limit(200).lean();
  res.json({ orders });
});

router.get("/admin/commissions", requireAuth, requireRole("admin"), async (_req, res) => {
  const commissions = await Commission.find().sort({ createdAt: -1 }).limit(200).lean();
  res.json({ commissions });
});

router.get("/admin/reports", requireAuth, requireRole("admin"), async (_req, res) => {
  const reports = await Report.find().sort({ createdAt: -1 }).limit(200).lean();
  res.json({ reports });
});

router.patch("/admin/reports/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const status = String(req.body?.status || "").toUpperCase();
  if (!["REVIEWED", "RESOLVED"].includes(status)) {
    throw httpError(400, "INVALID_REPORT_STATUS", "Choose REVIEWED or RESOLVED.");
  }
  const report = await Report.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true });
  if (!report) throw httpError(404, "REPORT_NOT_FOUND", "Report not found.");
  res.json({ report });
});

export default router;
