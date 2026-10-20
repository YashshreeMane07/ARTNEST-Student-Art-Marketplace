import { Router } from "express";
import { currentUser, requireAuth } from "../middlewares/auth";
import { httpError } from "../middlewares/errors";
import { Artwork, Cart, Notification, Order, Review, User, Wishlist } from "../models";
import { notify, publicArtwork, text } from "./helpers";

const router = Router();

router.get("/wishlist", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const wishlist = await Wishlist.findOne({ userId: user.id }).populate("artworkIds").lean();
  const artworks = (wishlist?.artworkIds || [])
    .filter((artwork: any) => artwork && artwork.status === "PUBLISHED")
    .map(publicArtwork);
  res.json({ artworkIds: artworks.map((artwork: any) => artwork.id), artworks });
});

router.post("/wishlist/:artworkId", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const artwork = await Artwork.findOne({ _id: req.params.artworkId, status: "PUBLISHED" });
  if (!artwork) throw httpError(404, "ARTWORK_NOT_FOUND", "This artwork is not available.");
  const result = await Wishlist.updateOne(
    { userId: user.id },
    { $addToSet: { artworkIds: artwork._id }, $setOnInsert: { userId: user.id } },
    { upsert: true },
  );
  if (result.modifiedCount > 0 || result.upsertedCount > 0) {
    await Artwork.updateOne({ _id: artwork._id }, { $inc: { saves: 1 } });
  }
  const wishlist = await Wishlist.findOne({ userId: user.id }).lean();
  res.json({ artworkIds: wishlist?.artworkIds || [] });
});

router.delete("/wishlist/:artworkId", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const result = await Wishlist.updateOne({ userId: user.id }, { $pull: { artworkIds: req.params.artworkId } });
  if (result.modifiedCount > 0) {
    await Artwork.updateOne({ _id: req.params.artworkId, saves: { $gt: 0 } }, { $inc: { saves: -1 } });
  }
  const wishlist = await Wishlist.findOne({ userId: user.id }).lean();
  res.json({ removed: result.modifiedCount > 0, artworkIds: wishlist?.artworkIds || [] });
});

router.get("/cart", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const cart = await Cart.findOne({ userId: user.id }).lean();
  const items = [];
  for (const item of cart?.items || []) {
    const artwork = await Artwork.findOne({ _id: item.artworkId, status: "PUBLISHED" }).lean();
    if (artwork) {
      items.push({
        artworkId: artwork._id,
        quantity: item.quantity,
        price: artwork.price,
        artwork: publicArtwork(artwork),
      });
    }
  }
  res.json({ items });
});

router.post("/cart", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const artworkId = text(req.body?.artworkId, 100);
  const quantity = Math.max(1, Math.min(10, Number.parseInt(String(req.body?.quantity || "1"), 10) || 1));
  const artwork = await Artwork.findOne({ _id: artworkId, status: "PUBLISHED" });
  if (!artwork) throw httpError(404, "ARTWORK_NOT_FOUND", "This artwork is not available.");
  const cart = await Cart.findOne({ userId: user.id });
  if (!cart) {
    await Cart.create({ userId: user.id, items: [{ artworkId, quantity, priceSnapshot: artwork.price }] });
  } else {
    const item = cart.items.find((entry: any) => entry.artworkId === artworkId);
    if (item) {
      item.quantity = Math.min(10, item.quantity + quantity);
      item.priceSnapshot = artwork.price;
    } else {
      cart.items.push({ artworkId, quantity, priceSnapshot: artwork.price });
    }
    await cart.save();
  }
  res.status(201).json({ added: artworkId });
});

router.patch("/cart/:artworkId", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const quantity = Number(req.body?.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    throw httpError(400, "INVALID_QUANTITY", "Quantity must be from 1 to 10.");
  }
  const artwork = await Artwork.findOne({ _id: req.params.artworkId, status: "PUBLISHED" });
  if (!artwork) throw httpError(404, "ARTWORK_NOT_FOUND", "This artwork is not available.");
  await Cart.updateOne(
    { userId: user.id, "items.artworkId": req.params.artworkId },
    { $set: { "items.$.quantity": quantity, "items.$.priceSnapshot": artwork.price } },
  );
  res.json({ updated: true });
});

router.delete("/cart/:artworkId", requireAuth, async (req, res) => {
  const user = currentUser(req);
  await Cart.updateOne({ userId: user.id }, { $pull: { items: { artworkId: req.params.artworkId } } });
  res.status(204).end();
});

router.delete("/cart", requireAuth, async (req, res) => {
  await Cart.updateOne({ userId: currentUser(req).id }, { $set: { items: [] } }, { upsert: true });
  res.status(204).end();
});

router.post("/orders", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const cart = await Cart.findOne({ userId: user.id }).lean();
  const sourceItems = cart?.items || [];
  if (!sourceItems.length) throw httpError(400, "CART_EMPTY", "Add artwork to your cart first.");

  const items = [];
  for (const item of sourceItems) {
    const artwork = await Artwork.findOne({ _id: item.artworkId, status: "PUBLISHED" }).lean();
    if (!artwork) throw httpError(409, "ARTWORK_UNAVAILABLE", "One or more cart items are no longer available.");
    if (artwork.creatorId === user.id) throw httpError(400, "CANNOT_BUY_OWN_ART", "You cannot buy your own artwork.");
    items.push({
      artworkId: artwork._id,
      creatorId: artwork.creatorId,
      title: artwork.title,
      imageUrl: artwork.imageUrl,
      quantity: item.quantity,
      unitPrice: artwork.price,
    });
  }
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const platformFee = Math.round(subtotal * 0.045);
  const order = await Order.create({
    buyerId: user.id,
    items,
    subtotal,
    platformFee,
    amount: subtotal + platformFee,
    paymentProvider: "none",
    paymentStatus: "PENDING",
    orderStatus: "PENDING",
  });
  res.status(201).json({
    order: order.toObject(),
    payment: {
      status: "provider_required",
      message: "No live payment provider is connected. This order remains unpaid.",
    },
  });
});

router.post("/orders/:id/demo-confirm", requireAuth, async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    throw httpError(403, "DEMO_PAYMENT_DISABLED", "Simulated checkout is disabled in production.");
  }
  const user = currentUser(req);
  const order = await Order.findOne({ _id: req.params.id, buyerId: user.id });
  if (!order) throw httpError(404, "ORDER_NOT_FOUND", "Order not found.");
  if (order.paymentStatus !== "PENDING") {
    throw httpError(409, "ORDER_NOT_PENDING", "This order is no longer awaiting demo confirmation.");
  }
  order.paymentProvider = "demo";
  order.paymentStatus = "SIMULATED";
  order.orderStatus = "PAID";
  order.isDemo = true;
  order.paidAt = new Date();
  await order.save();
  await Cart.updateOne({ userId: user.id }, { $set: { items: [] } });
  const creatorIds: string[] = [...new Set<string>(order.items.map((item: any) => String(item.creatorId)))];
  for (const creatorId of creatorIds) {
    await notify(
      creatorId,
      "order",
      "Demo purchase recorded",
      `${user.name} completed a simulated order. No real payment was collected.`,
      { orderId: order._id, demo: true },
    );
  }
  res.json({ order, simulated: true, message: "Demo only — no real payment was collected." });
});

router.get("/orders", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const orders = await Order.find({
    $or: [{ buyerId: user.id }, { "items.creatorId": user.id }],
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  res.json({ orders });
});

router.get("/orders/:id", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const order = await Order.findById(req.params.id).lean();
  if (!order) throw httpError(404, "ORDER_NOT_FOUND", "Order not found.");
  const permitted =
    order.buyerId === user.id ||
    order.items.some((item: any) => item.creatorId === user.id) ||
    user.role === "admin";
  if (!permitted) throw httpError(403, "NOT_ORDER_PARTICIPANT", "You cannot view this order.");
  res.json({ order });
});

router.patch("/orders/:id/status", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const status = String(req.body?.status || "");
  if (!["PROCESSING", "COMPLETED", "CANCELLED"].includes(status)) {
    throw httpError(400, "INVALID_ORDER_STATUS", "That order status is not supported.");
  }
  const order = await Order.findById(req.params.id);
  if (!order) throw httpError(404, "ORDER_NOT_FOUND", "Order not found.");
  const isCreator = order.items.some((item: any) => item.creatorId === user.id);
  if (!isCreator && user.role !== "admin") {
    throw httpError(403, "NOT_ORDER_CREATOR", "Only a creator on this order can update its status.");
  }
  if (order.paymentStatus !== "PAID" && order.paymentStatus !== "SIMULATED") {
    throw httpError(409, "ORDER_UNPAID", "Unpaid orders cannot be processed.");
  }
  order.orderStatus = status;
  await order.save();
  res.json({ order });
});

router.post("/artworks/:id/reviews", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const orderId = text(req.body?.orderId, 100);
  const rating = Number(req.body?.rating);
  const comment = text(req.body?.comment, 1500);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw httpError(400, "INVALID_RATING", "Rating must be from 1 to 5.");
  }
  const order = await Order.findOne({
    _id: orderId,
    buyerId: user.id,
    orderStatus: "COMPLETED",
    paymentStatus: { $in: ["PAID", "SIMULATED"] },
    "items.artworkId": req.params.id,
  });
  if (!order) throw httpError(403, "PURCHASE_REQUIRED", "Complete a purchase of this artwork before reviewing it.");
  const item = order.items.find((entry: any) => entry.artworkId === req.params.id);
  try {
    const review = await Review.create({
      orderId: order._id,
      buyerId: user.id,
      artworkId: req.params.id,
      creatorId: item.creatorId,
      rating,
      comment,
    });
    const ratings = await Review.find({ creatorId: item.creatorId }).select("rating").lean();
    const average = ratings.reduce((sum, item) => sum + item.rating, 0) / Math.max(1, ratings.length);
    await User.updateOne({ _id: item.creatorId }, { $set: { rating: Math.round(average * 10) / 10 } });
    await notify(item.creatorId, "review", "A buyer left a review", `${user.name} reviewed ${item.title}.`, {
      artworkId: req.params.id,
    });
    res.status(201).json({ review });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      throw httpError(409, "DUPLICATE_REVIEW", "You have already reviewed this purchase.");
    }
    throw error;
  }
});

router.get("/artworks/:id/reviews", async (req, res) => {
  const reviews = await Review.find({ artworkId: req.params.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("buyerId", "name profileImage")
    .lean();
  res.json({ reviews });
});

export default router;
