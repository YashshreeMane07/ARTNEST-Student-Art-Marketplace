import { Router } from "express";
import { currentUser, requireAuth, requireRole } from "../middlewares/auth";
import { imageUpload } from "../middlewares/upload";
import { Notification, User, Verification } from "../models";
import { uploadImage } from "../services/cloudinary";
import { httpError } from "../middlewares/errors";

const router = Router();

router.get("/auth/me", requireAuth, async (req, res) => {
  const user = await User.findById(currentUser(req).id).select("-__v").lean();
  if (!user) throw httpError(404, "USER_NOT_FOUND", "Your account could not be found.");
  res.json({ user: { ...user, id: user._id } });
});

router.patch("/auth/me", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const body = req.body as Record<string, unknown>;
  const allowed = ["name", "bio", "college", "course", "location", "skills", "socialLinks", "commissionAvailable"];
  const update: Record<string, unknown> = {};
  for (const field of allowed) {
    if (body[field] !== undefined) update[field] = body[field];
  }
  if (typeof update.name === "string") update.name = update.name.trim().slice(0, 80);
  if (typeof update.bio === "string") update.bio = update.bio.trim().slice(0, 1200);
  if (typeof update.college === "string") update.college = update.college.trim().slice(0, 160);
  if (typeof update.course === "string") update.course = update.course.trim().slice(0, 160);
  if (typeof update.location === "string") update.location = update.location.trim().slice(0, 120);
  if (update.skills !== undefined) {
    if (!Array.isArray(update.skills) || update.skills.length > 25) {
      throw httpError(400, "INVALID_SKILLS", "Provide up to 25 skills.");
    }
    update.skills = update.skills.map((value) => String(value).trim().slice(0, 60)).filter(Boolean);
  }
  if (update.socialLinks !== undefined) {
    if (!update.socialLinks || typeof update.socialLinks !== "object" || Array.isArray(update.socialLinks)) {
      throw httpError(400, "INVALID_SOCIAL_LINKS", "Social links must be an object.");
    }
    update.socialLinks = Object.fromEntries(
      Object.entries(update.socialLinks as Record<string, unknown>)
        .slice(0, 6)
        .map(([key, value]) => [key.slice(0, 40), String(value).slice(0, 240)]),
    );
  }
  const updated = await User.findByIdAndUpdate(user.id, { $set: update }, { new: true, runValidators: true }).lean();
  res.json({ user: updated ? { ...updated, id: updated._id } : null });
});

router.patch("/auth/role", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const role = req.body?.role;
  if (!["buyer", "student_creator"].includes(role)) {
    throw httpError(400, "INVALID_ROLE", "Choose buyer or student creator.");
  }
  if (user.role === "admin") {
    throw httpError(403, "ROLE_LOCKED", "An admin account cannot change its role here.");
  }
  const updated = await User.findByIdAndUpdate(
    user.id,
    { $set: { role } },
    { new: true, runValidators: true },
  ).lean();
  res.json({ user: updated ? { ...updated, id: updated._id } : null });
});

router.post(
  "/auth/profile-image",
  requireAuth,
  imageUpload.single("image"),
  async (req, res) => {
    if (!req.file) throw httpError(400, "IMAGE_REQUIRED", "Choose an image file.");
    const user = currentUser(req);
    const uploaded = await uploadImage(req.file.buffer, "artnest/profiles");
    const updated = await User.findByIdAndUpdate(
      user.id,
      { $set: { profileImage: uploaded.url } },
      { new: true },
    ).lean();
    res.json({ profileImage: updated?.profileImage || uploaded.url });
  },
);

router.get("/auth/verification", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const verification = await Verification.findById(user.id).select("-__v").lean();
  res.json({ verification: verification || null });
});

router.post("/auth/verification", requireAuth, requireRole("student_creator"), async (req, res) => {
  const user = currentUser(req);
  const studentEmail = String(req.body?.studentEmail || "").trim().toLowerCase();
  const college = String(req.body?.college || "").trim().slice(0, 160);
  const course = String(req.body?.course || "").trim().slice(0, 160);
  const evidenceNote = String(req.body?.evidenceNote || "").trim().slice(0, 1200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentEmail) || !college || !course) {
    throw httpError(400, "INVALID_VERIFICATION", "Provide a valid student email, college, and course.");
  }
  const verification = await Verification.findOneAndUpdate(
    { userId: user.id },
    {
      $set: {
        studentEmail,
        college,
        course,
        evidenceNote,
        status: "PENDING",
        reviewedBy: "",
        reviewedAt: null,
        adminNote: "",
      },
      $setOnInsert: { _id: user.id, userId: user.id },
    },
    { new: true, upsert: true, runValidators: true },
  ).lean();
  await User.findByIdAndUpdate(user.id, {
    $set: {
      college,
      course,
      verificationStatus: "PENDING",
      verificationSubmittedAt: new Date(),
      verifiedStudentEmail: studentEmail,
    },
  });
  res.status(202).json({ verification });
});

router.post("/reports", requireAuth, async (req, res) => {
  const { Report } = await import("../models");
  const targetType = req.body?.targetType;
  const targetId = String(req.body?.targetId || "").trim();
  const reason = String(req.body?.reason || "").trim().slice(0, 1200);
  if (!["artwork", "user", "collaboration"].includes(targetType) || !targetId || !reason) {
    throw httpError(400, "INVALID_REPORT", "Provide a report type, target, and reason.");
  }
  const report = await Report.create({
    reporterId: currentUser(req).id,
    targetType,
    targetId,
    reason,
  });
  res.status(201).json({ report });
});

export default router;
