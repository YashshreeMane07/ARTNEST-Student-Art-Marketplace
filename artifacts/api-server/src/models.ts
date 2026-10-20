import mongoose, { Schema, type Model } from "mongoose";
import { randomUUID } from "node:crypto";

const model = (name: string, schema: Schema): Model<any> =>
  (mongoose.models[name] as Model<any> | undefined) ??
  mongoose.model(name, schema);

const timestamps = { timestamps: true, versionKey: false } as const;

const userSchema = new Schema(
  {
    _id: { type: String, required: true },
    firebaseUid: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, lowercase: true, index: true },
    role: {
      type: String,
      enum: ["buyer", "student_creator", "admin"],
      default: "buyer",
      index: true,
    },
    profileImage: { type: String, default: "" },
    bio: { type: String, default: "", maxlength: 1200 },
    college: { type: String, default: "", maxlength: 160 },
    course: { type: String, default: "", maxlength: 160 },
    location: { type: String, default: "", maxlength: 120 },
    skills: { type: [String], default: [] },
    socialLinks: { type: Schema.Types.Mixed, default: {} },
    verificationStatus: {
      type: String,
      enum: ["PENDING", "VERIFIED", "REJECTED"],
      default: "PENDING",
      index: true,
    },
    verificationSubmittedAt: Date,
    verificationReviewedAt: Date,
    verificationNote: { type: String, default: "", maxlength: 500 },
    verifiedStudentEmail: { type: String, default: "" },
    followers: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    totalSales: { type: Number, default: 0 },
    totalViews: { type: Number, default: 0 },
    commissionAvailable: { type: Boolean, default: true },
    isDemo: { type: Boolean, default: false },
  },
  timestamps,
);

const artworkSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    creatorId: { type: String, required: true, index: true, ref: "User" },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    imageUrl: { type: String, required: true },
    imagePublicId: { type: String, default: "" },
    category: { type: String, required: true, trim: true, maxlength: 80 },
    style: { type: String, default: "", maxlength: 80 },
    tags: { type: [String], default: [] },
    keywords: { type: [String], default: [] },
    price: { type: Number, required: true, min: 0, max: 1000000 },
    status: {
      type: String,
      enum: ["DRAFT", "PUBLISHED", "REMOVED"],
      default: "PUBLISHED",
      index: true,
    },
    likes: { type: Number, default: 0 },
    likedBy: { type: [String], default: [], select: false },
    saves: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    isDemo: { type: Boolean, default: false },
  },
  timestamps,
);
artworkSchema.index({ title: "text", description: "text", tags: "text", category: "text" });

const wishlistSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true, ref: "User" },
    artworkIds: [{ type: String, ref: "Artwork" }],
  },
  timestamps,
);

const cartItemSchema = new Schema(
  {
    artworkId: { type: String, required: true, ref: "Artwork" },
    quantity: { type: Number, required: true, min: 1, max: 10, default: 1 },
    priceSnapshot: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);
const cartSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true, ref: "User" },
    items: { type: [cartItemSchema], default: [] },
  },
  timestamps,
);

const orderItemSchema = new Schema(
  {
    artworkId: { type: String, required: true },
    creatorId: { type: String, required: true },
    title: { type: String, required: true },
    imageUrl: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1, max: 10 },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);
const orderSchema = new Schema(
  {
    _id: { type: String, default: () => `AN-${randomUUID()}` },
    buyerId: { type: String, required: true, index: true, ref: "User" },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    platformFee: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    paymentProvider: { type: String, enum: ["demo", "stripe", "whop", "none"], default: "none" },
    providerOrderId: { type: String, default: "" },
    providerPaymentId: { type: String, default: "" },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "SIMULATED", "FAILED", "REFUNDED"],
      default: "PENDING",
      index: true,
    },
    orderStatus: {
      type: String,
      enum: ["PENDING", "PAID", "PROCESSING", "COMPLETED", "CANCELLED", "REFUNDED"],
      default: "PENDING",
      index: true,
    },
    isDemo: { type: Boolean, default: false },
    paidAt: Date,
  },
  timestamps,
);

const commissionSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    buyerId: { type: String, required: true, index: true, ref: "User" },
    creatorId: { type: String, required: true, index: true, ref: "User" },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    referenceImage: { type: String, default: "" },
    budget: { type: Number, required: true, min: 0, max: 1000000 },
    deadline: Date,
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "REJECTED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
    creatorNote: { type: String, default: "", maxlength: 1000 },
  },
  timestamps,
);

const conversationSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    participantIds: { type: [{ type: String, ref: "User" }], required: true, index: true },
    participantKey: { type: String, required: true, unique: true },
    lastMessage: { type: String, default: "" },
    lastMessageAt: { type: Date, default: Date.now },
  },
  timestamps,
);
const messageSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    conversationId: { type: String, required: true, index: true, ref: "Conversation" },
    senderId: { type: String, required: true, index: true, ref: "User" },
    receiverId: { type: String, required: true, index: true, ref: "User" },
    message: { type: String, required: true, trim: true, maxlength: 4000 },
    readAt: Date,
  },
  timestamps,
);

const collaborationSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    creatorId: { type: String, required: true, index: true, ref: "User" },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 3000 },
    skillsRequired: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
      default: "OPEN",
      index: true,
    },
    applicants: {
      type: [
        new Schema(
          {
            creatorId: { type: String, required: true, ref: "User" },
            message: { type: String, default: "", maxlength: 1000 },
            status: { type: String, enum: ["PENDING", "ACCEPTED", "REJECTED"], default: "PENDING" },
            createdAt: { type: Date, default: Date.now },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  timestamps,
);

const reviewSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    orderId: { type: String, required: true, index: true, ref: "Order" },
    buyerId: { type: String, required: true, index: true, ref: "User" },
    artworkId: { type: String, required: true, index: true, ref: "Artwork" },
    creatorId: { type: String, required: true, index: true, ref: "User" },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "", maxlength: 1500 },
  },
  timestamps,
);
reviewSchema.index({ orderId: 1, buyerId: 1 }, { unique: true });

const followSchema = new Schema(
  {
    followerId: { type: String, required: true, index: true, ref: "User" },
    followingId: { type: String, required: true, index: true, ref: "User" },
  },
  timestamps,
);
followSchema.index({ followerId: 1, followingId: 1 }, { unique: true });

const notificationSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    userId: { type: String, required: true, index: true, ref: "User" },
    type: { type: String, required: true, maxlength: 60 },
    title: { type: String, required: true, maxlength: 160 },
    message: { type: String, required: true, maxlength: 500 },
    read: { type: Boolean, default: false, index: true },
    data: { type: Schema.Types.Mixed, default: {} },
  },
  timestamps,
);

const portfolioProjectSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    creatorId: { type: String, required: true, index: true, ref: "User" },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, default: "", maxlength: 3000 },
    imageUrl: { type: String, default: "" },
    imagePublicId: { type: String, default: "" },
    skills: { type: [String], default: [] },
    links: { type: [String], default: [] },
  },
  timestamps,
);

const reportSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    reporterId: { type: String, required: true, ref: "User" },
    targetType: { type: String, enum: ["artwork", "user", "collaboration"], required: true },
    targetId: { type: String, required: true, index: true },
    reason: { type: String, required: true, maxlength: 1200 },
    status: { type: String, enum: ["OPEN", "REVIEWED", "RESOLVED"], default: "OPEN", index: true },
  },
  timestamps,
);

const verificationSchema = new Schema(
  {
    _id: { type: String, required: true, ref: "User" },
    userId: { type: String, required: true, unique: true, index: true, ref: "User" },
    studentEmail: { type: String, required: true, lowercase: true },
    college: { type: String, required: true },
    course: { type: String, required: true },
    evidenceNote: { type: String, default: "", maxlength: 1200 },
    status: {
      type: String,
      enum: ["PENDING", "VERIFIED", "REJECTED"],
      default: "PENDING",
      index: true,
    },
    reviewedBy: { type: String, default: "" },
    reviewedAt: Date,
    adminNote: { type: String, default: "", maxlength: 500 },
  },
  timestamps,
);

export const User = model("User", userSchema);
export const Artwork = model("Artwork", artworkSchema);
export const Wishlist = model("Wishlist", wishlistSchema);
export const Cart = model("Cart", cartSchema);
export const Order = model("Order", orderSchema);
export const Commission = model("Commission", commissionSchema);
export const Conversation = model("Conversation", conversationSchema);
export const Message = model("Message", messageSchema);
export const Collaboration = model("Collaboration", collaborationSchema);
export const Review = model("Review", reviewSchema);
export const Follow = model("Follow", followSchema);
export const Notification = model("Notification", notificationSchema);
export const PortfolioProject = model("PortfolioProject", portfolioProjectSchema);
export const Report = model("Report", reportSchema);
export const Verification = model("Verification", verificationSchema);
