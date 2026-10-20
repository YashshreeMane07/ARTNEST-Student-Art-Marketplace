import type { Request } from "express";
import { Notification, User } from "../models";
import { httpError } from "../middlewares/errors";

export function text(value: unknown, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function stringList(value: unknown, maxItems = 15, maxLength = 60): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  return [...new Set(values.map((item) => String(item).trim().slice(0, maxLength)).filter(Boolean))].slice(
    0,
    maxItems,
  );
}

export function pageOptions(req: Request) {
  const page = Math.max(1, Number.parseInt(String(req.query.page || "1"), 10) || 1);
  const limit = Math.min(80, Math.max(1, Number.parseInt(String(req.query.limit || "24"), 10) || 24));
  return { page, limit, skip: (page - 1) * limit };
}

export function safePattern(value: string): RegExp {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

export async function notify(
  userId: string,
  type: string,
  title: string,
  message: string,
  data: Record<string, unknown> = {},
) {
  if (!userId) return;
  await Notification.create({ userId, type, title, message, data });
}

export async function requireCreator(userId: string) {
  const user = await User.findById(userId);
  if (!user || !["student_creator", "admin"].includes(user.role)) {
    throw httpError(403, "CREATOR_REQUIRED", "Choose the student creator role to use this feature.");
  }
  return user;
}

export function publicArtwork(artwork: any) {
  const value = typeof artwork?.toObject === "function" ? artwork.toObject() : artwork;
  if (!value) return value;
  return {
    ...value,
    id: value._id,
    image: value.imageUrl,
    created: value.createdAt ? new Date(value.createdAt).getTime() : 0,
  };
}

export function publicCreator(user: any, works = 0) {
  return {
    id: user._id,
    name: user.name,
    initials: String(user.name || "AN")
      .split(/\s+/)
      .slice(0, 2)
      .map((part: string) => part[0] || "")
      .join("")
      .toUpperCase(),
    college: user.college || "",
    location: user.location || "",
    bio: user.bio || "",
    followers: user.followers || 0,
    works,
    rating: user.rating || 0,
    skills: user.skills || [],
    profileImage: user.profileImage || "",
    verificationStatus: user.verificationStatus || "PENDING",
    commissionAvailable: user.commissionAvailable !== false,
    isDemo: Boolean(user.isDemo),
  };
}
