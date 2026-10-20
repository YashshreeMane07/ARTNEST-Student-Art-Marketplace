import type { NextFunction, Request, Response } from "express";
import { firebaseAuth } from "../config/firebase";
import { User } from "../models";

export type AppRole = "buyer" | "student_creator" | "admin";
export type AuthenticatedUser = {
  id: string;
  firebaseUid: string;
  name: string;
  email: string;
  role: AppRole;
  profileImage: string;
  bio: string;
  college: string;
  course: string;
  location: string;
  skills: string[];
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
  isDemo?: boolean;
};

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
    }
  }
}

function serializeUser(user: any): AuthenticatedUser {
  return {
    id: user._id,
    firebaseUid: user.firebaseUid,
    name: user.name,
    email: user.email,
    role: user.role,
    profileImage: user.profileImage || "",
    bio: user.bio || "",
    college: user.college || "",
    course: user.course || "",
    location: user.location || "",
    skills: user.skills || [],
    verificationStatus: user.verificationStatus || "PENDING",
    isDemo: Boolean(user.isDemo),
  };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authorization = req.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) {
    res.status(401).json({ error: "AUTH_REQUIRED", message: "Sign in to continue." });
    return;
  }

  try {
    const decoded = await firebaseAuth().verifyIdToken(token, true);
    const uid = decoded.uid;
    const email = (decoded.email || "").toLowerCase();
    const adminEmail = process.env.ARTNEST_ADMIN_EMAIL?.trim().toLowerCase();
    const isBootstrapAdmin =
      Boolean(adminEmail) && Boolean(decoded.email_verified) && email === adminEmail;

    let user = await User.findById(uid);
    if (!user) {
      user = await User.create({
        _id: uid,
        firebaseUid: uid,
        name:
          typeof decoded.name === "string" && decoded.name.trim()
            ? decoded.name.trim().slice(0, 80)
            : email.split("@")[0] || "ARTNEST creator",
        email,
        role: isBootstrapAdmin ? "admin" : "buyer",
        profileImage: typeof decoded.picture === "string" ? decoded.picture : "",
      });
    } else {
      if (user.email !== email) user.email = email;
      if (isBootstrapAdmin && user.role !== "admin") user.role = "admin";
      await user.save();
    }
    req.authUser = serializeUser(user);
    next();
  } catch {
    res.status(401).json({ error: "INVALID_TOKEN", message: "Your session expired. Sign in again." });
  }
}

export function requireRole(...roles: AppRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      res.status(401).json({ error: "AUTH_REQUIRED", message: "Sign in to continue." });
      return;
    }
    if (!roles.includes(req.authUser.role)) {
      res.status(403).json({ error: "FORBIDDEN", message: "You do not have permission for this action." });
      return;
    }
    next();
  };
}

export const currentUser = (req: Request): AuthenticatedUser => {
  if (!req.authUser) throw new Error("Authenticated route is missing a user.");
  return req.authUser;
};
