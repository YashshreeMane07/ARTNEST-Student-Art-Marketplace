import { Router } from "express";
import { currentUser, requireAuth } from "../middlewares/auth";
import { httpError } from "../middlewares/errors";
import {
  Collaboration,
  Commission,
  Conversation,
  Message,
  Notification,
  PortfolioProject,
  User,
} from "../models";
import { notify, publicArtwork, requireCreator, stringList, text } from "./helpers";
import { Artwork } from "../models";

const router = Router();

router.get("/commissions", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const commissions = await Commission.find({ $or: [{ buyerId: user.id }, { creatorId: user.id }] })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate("buyerId", "name profileImage")
    .populate("creatorId", "name profileImage college verificationStatus")
    .lean();
  res.json({ commissions });
});

router.post("/commissions", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const creatorId = text(req.body?.creatorId, 100);
  const title = text(req.body?.title, 120);
  const description = text(req.body?.description, 4000);
  const budget = Number(req.body?.budget);
  const deadline = req.body?.deadline ? new Date(req.body.deadline) : undefined;
  if (!creatorId || !title || !description || !Number.isFinite(budget) || budget < 0 || budget > 1000000) {
    throw httpError(400, "INVALID_COMMISSION", "Provide an artist, title, description, and valid budget.");
  }
  if (deadline && Number.isNaN(deadline.getTime())) {
    throw httpError(400, "INVALID_DEADLINE", "Choose a valid commission deadline.");
  }
  if (creatorId === user.id) throw httpError(400, "SELF_COMMISSION", "You cannot commission yourself.");
  const creator = await User.findOne({ _id: creatorId, role: "student_creator" });
  if (!creator) throw httpError(404, "CREATOR_NOT_FOUND", "The selected creator was not found.");
  const commission = await Commission.create({
    buyerId: user.id,
    creatorId,
    title,
    description,
    referenceImage: text(req.body?.referenceImage, 500),
    budget,
    deadline,
    status: "PENDING",
  });
  await notify(creatorId, "commission", "A commission request arrived", `${user.name} requested ${title}.`, {
    commissionId: commission._id,
  });
  res.status(201).json({ commission });
});

router.get("/commissions/:id", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const commission = await Commission.findById(req.params.id)
    .populate("buyerId", "name profileImage")
    .populate("creatorId", "name profileImage college verificationStatus")
    .lean();
  if (!commission) throw httpError(404, "COMMISSION_NOT_FOUND", "Commission not found.");
  if (![String(commission.buyerId?._id || commission.buyerId), String(commission.creatorId?._id || commission.creatorId)].includes(user.id) && user.role !== "admin") {
    throw httpError(403, "NOT_COMMISSION_PARTICIPANT", "You cannot view this commission.");
  }
  res.json({ commission });
});

router.put("/commissions/:id", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const commission = await Commission.findById(req.params.id);
  if (!commission) throw httpError(404, "COMMISSION_NOT_FOUND", "Commission not found.");
  const status = String(req.body?.status || "");
  const isBuyer = commission.buyerId === user.id;
  const isCreator = commission.creatorId === user.id;
  if (isBuyer && status === "CANCELLED" && commission.status === "PENDING") {
    commission.status = "CANCELLED";
  } else if (isCreator && ["ACCEPTED", "IN_PROGRESS", "COMPLETED", "REJECTED"].includes(status)) {
    const transitions: Record<string, string[]> = {
      PENDING: ["ACCEPTED", "REJECTED"],
      ACCEPTED: ["IN_PROGRESS", "COMPLETED"],
      IN_PROGRESS: ["COMPLETED"],
    };
    if (!transitions[commission.status]?.includes(status)) {
      throw httpError(409, "INVALID_TRANSITION", "That commission status change is not allowed.");
    }
    commission.status = status;
  } else if (user.role === "admin" && ["PENDING", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "REJECTED", "CANCELLED"].includes(status)) {
    commission.status = status;
  } else {
    throw httpError(403, "NOT_COMMISSION_PARTICIPANT", "You cannot update this commission.");
  }
  if (req.body?.creatorNote !== undefined && (isCreator || user.role === "admin")) {
    commission.creatorNote = text(req.body.creatorNote, 1000);
  }
  await commission.save();
  const recipientId = isCreator ? commission.buyerId : commission.creatorId;
  await notify(recipientId, "commission", `Commission ${commission.status.toLowerCase()}`, `${commission.title} is now ${commission.status.toLowerCase().replace("_", " ")}.`, {
    commissionId: commission._id,
  });
  res.json({ commission });
});

router.delete("/commissions/:id", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const commission = await Commission.findById(req.params.id);
  if (!commission) throw httpError(404, "COMMISSION_NOT_FOUND", "Commission not found.");
  if (commission.buyerId !== user.id && user.role !== "admin") {
    throw httpError(403, "NOT_COMMISSION_OWNER", "Only the requester can cancel this commission.");
  }
  if (!["PENDING", "ACCEPTED"].includes(commission.status)) {
    throw httpError(409, "COMMISSION_LOCKED", "This commission can no longer be cancelled.");
  }
  commission.status = "CANCELLED";
  await commission.save();
  res.json({ commission });
});

router.get("/conversations", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const conversations = await Conversation.find({ participantIds: user.id })
    .sort({ lastMessageAt: -1 })
    .populate("participantIds", "name profileImage role college")
    .lean();
  res.json({ conversations });
});

router.post("/conversations", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const participantId = text(req.body?.participantId, 100);
  if (!participantId || participantId === user.id) {
    throw httpError(400, "INVALID_PARTICIPANT", "Choose another ARTNEST user to message.");
  }
  const participant = await User.findById(participantId).select("_id");
  if (!participant) throw httpError(404, "USER_NOT_FOUND", "That user could not be found.");
  const participantIds = [user.id, participantId].sort();
  const participantKey = participantIds.join("|");
  const conversation = await Conversation.findOneAndUpdate(
    { participantKey },
    {
      $setOnInsert: {
        participantIds,
        participantKey,
        lastMessage: "",
        lastMessageAt: new Date(),
      },
    },
    { new: true, upsert: true },
  )
    .populate("participantIds", "name profileImage role college")
    .lean();
  res.status(201).json({ conversation });
});

router.get("/conversations/:id/messages", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const conversation = await Conversation.findOne({ _id: req.params.id, participantIds: user.id });
  if (!conversation) throw httpError(404, "CONVERSATION_NOT_FOUND", "Conversation not found.");
  const messages = await Message.find({ conversationId: conversation._id })
    .sort({ createdAt: 1 })
    .limit(500)
    .lean();
  await Message.updateMany(
    { conversationId: conversation._id, receiverId: user.id, readAt: { $exists: false } },
    { $set: { readAt: new Date() } },
  );
  res.json({ messages });
});

router.post("/conversations/:id/messages", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const content = text(req.body?.message, 4000);
  if (!content) throw httpError(400, "EMPTY_MESSAGE", "Write a message before sending.");
  const conversation = await Conversation.findOne({ _id: req.params.id, participantIds: user.id });
  if (!conversation) throw httpError(404, "CONVERSATION_NOT_FOUND", "Conversation not found.");
  const receiverId = conversation.participantIds.find((id: string) => id !== user.id);
  if (!receiverId) throw httpError(409, "INVALID_CONVERSATION", "This conversation has no other participant.");
  const message = await Message.create({
    conversationId: conversation._id,
    senderId: user.id,
    receiverId,
    message: content,
  });
  conversation.lastMessage = content;
  conversation.lastMessageAt = new Date();
  await conversation.save();
  await notify(receiverId, "message", "A new message", `${user.name}: ${content.slice(0, 120)}`, {
    conversationId: conversation._id,
  });
  res.status(201).json({ message });
});

router.get("/collaborations", async (req, res) => {
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.status = String(req.query.status).toUpperCase();
  const opportunities = await Collaboration.find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .populate("creatorId", "name college profileImage skills verificationStatus")
    .lean();
  res.json({ collaborations: opportunities });
});

router.post("/collaborations", requireAuth, async (req, res) => {
  const user = currentUser(req);
  await requireCreator(user.id);
  const title = text(req.body?.title, 120);
  const description = text(req.body?.description, 3000);
  if (!title || !description) throw httpError(400, "INVALID_COLLABORATION", "Add a title and description.");
  const collaboration = await Collaboration.create({
    creatorId: user.id,
    title,
    description,
    skillsRequired: stringList(req.body?.skillsRequired, 12),
    status: "OPEN",
  });
  res.status(201).json({ collaboration });
});

router.post("/collaborations/:id/apply", requireAuth, async (req, res) => {
  const user = currentUser(req);
  await requireCreator(user.id);
  const collaboration = await Collaboration.findById(req.params.id);
  if (!collaboration || collaboration.status !== "OPEN") {
    throw httpError(404, "COLLABORATION_NOT_OPEN", "This opportunity is no longer open.");
  }
  if (collaboration.creatorId === user.id) {
    throw httpError(400, "SELF_APPLICATION", "You cannot apply to your own opportunity.");
  }
  if (collaboration.applicants.some((applicant: any) => applicant.creatorId === user.id)) {
    throw httpError(409, "ALREADY_APPLIED", "You have already applied to this opportunity.");
  }
  collaboration.applicants.push({
    creatorId: user.id,
    message: text(req.body?.message, 1000),
    status: "PENDING",
    createdAt: new Date(),
  });
  await collaboration.save();
  await notify(collaboration.creatorId, "collaboration", "A creator applied", `${user.name} applied to ${collaboration.title}.`, {
    collaborationId: collaboration._id,
  });
  res.status(201).json({ collaboration });
});

router.patch("/collaborations/:id", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const collaboration = await Collaboration.findById(req.params.id);
  if (!collaboration) throw httpError(404, "COLLABORATION_NOT_FOUND", "Opportunity not found.");
  if (collaboration.creatorId !== user.id && user.role !== "admin") {
    throw httpError(403, "NOT_COLLABORATION_OWNER", "Only the opportunity owner can manage applications.");
  }
  const applicantId = text(req.body?.applicantId, 100);
  const applicationStatus = String(req.body?.applicationStatus || "").toUpperCase();
  if (applicantId) {
    if (!["ACCEPTED", "REJECTED"].includes(applicationStatus)) {
      throw httpError(400, "INVALID_APPLICATION_STATUS", "Choose accepted or rejected.");
    }
    const application = collaboration.applicants.find((entry: any) => entry.creatorId === applicantId);
    if (!application) throw httpError(404, "APPLICATION_NOT_FOUND", "Application not found.");
    application.status = applicationStatus;
    if (applicationStatus === "ACCEPTED") collaboration.status = "IN_PROGRESS";
    await notify(applicantId, "collaboration", `Application ${applicationStatus.toLowerCase()}`, `Your application for ${collaboration.title} was ${applicationStatus.toLowerCase()}.`, {
      collaborationId: collaboration._id,
    });
  }
  if (req.body?.status) {
    const status = String(req.body.status).toUpperCase();
    if (!["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(status)) {
      throw httpError(400, "INVALID_STATUS", "That collaboration status is not supported.");
    }
    collaboration.status = status;
  }
  await collaboration.save();
  res.json({ collaboration });
});

router.get("/creators/:id/portfolio", async (req, res) => {
  const projects = await PortfolioProject.find({ creatorId: req.params.id }).sort({ createdAt: -1 }).lean();
  res.json({ projects });
});

router.post("/portfolio", requireAuth, async (req, res) => {
  const user = currentUser(req);
  await requireCreator(user.id);
  const title = text(req.body?.title, 140);
  if (!title) throw httpError(400, "TITLE_REQUIRED", "Add a project title.");
  const project = await PortfolioProject.create({
    creatorId: user.id,
    title,
    description: text(req.body?.description, 3000),
    imageUrl: text(req.body?.imageUrl, 500),
    skills: stringList(req.body?.skills, 20),
    links: stringList(req.body?.links, 10, 300),
  });
  res.status(201).json({ project });
});

router.put("/portfolio/:id", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const project = await PortfolioProject.findById(req.params.id);
  if (!project) throw httpError(404, "PROJECT_NOT_FOUND", "Portfolio project not found.");
  if (project.creatorId !== user.id && user.role !== "admin") {
    throw httpError(403, "NOT_PROJECT_OWNER", "You can only edit your own portfolio.");
  }
  for (const field of ["title", "description", "imageUrl"] as const) {
    if (req.body?.[field] !== undefined) {
      (project as any)[field] = text(req.body[field], field === "description" ? 3000 : 500);
    }
  }
  if (req.body?.skills !== undefined) project.skills = stringList(req.body.skills, 20);
  if (req.body?.links !== undefined) project.links = stringList(req.body.links, 10, 300);
  await project.save();
  res.json({ project });
});

router.delete("/portfolio/:id", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const project = await PortfolioProject.findById(req.params.id);
  if (!project) throw httpError(404, "PROJECT_NOT_FOUND", "Portfolio project not found.");
  if (project.creatorId !== user.id && user.role !== "admin") {
    throw httpError(403, "NOT_PROJECT_OWNER", "You can only remove your own portfolio work.");
  }
  await project.deleteOne();
  res.status(204).end();
});

router.get("/notifications", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const notes = await Notification.find({ userId: user.id }).sort({ createdAt: -1 }).limit(100).lean();
  const unread = await Notification.countDocuments({ userId: user.id, read: false });
  res.json({ notifications: notes, unread });
});

router.patch("/notifications/read-all", requireAuth, async (req, res) => {
  await Notification.updateMany({ userId: currentUser(req).id, read: false }, { $set: { read: true } });
  res.json({ updated: true });
});

router.patch("/notifications/:id/read", requireAuth, async (req, res) => {
  const result = await Notification.updateOne(
    { _id: req.params.id, userId: currentUser(req).id },
    { $set: { read: true } },
  );
  if (!result.matchedCount) throw httpError(404, "NOTIFICATION_NOT_FOUND", "Notification not found.");
  res.json({ updated: true });
});

export default router;
