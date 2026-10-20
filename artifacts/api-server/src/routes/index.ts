import { Router, type IRouter } from "express";
import analyticsRouter from "./analytics";
import aiRouter from "./ai";
import artworksRouter from "./artworks";
import authRouter from "./auth";
import commerceRouter from "./commerce";
import communityRouter from "./community";
import healthRouter from "./health";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(artworksRouter);
router.use(commerceRouter);
router.use(communityRouter);
router.use(analyticsRouter);
router.use(aiRouter);

export default router;
