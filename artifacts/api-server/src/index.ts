import app from "./app";
import { logger } from "./lib/logger";
import mongoose from "mongoose";
import { initializeFirebaseAdmin } from "./config/firebase";
import { connectMongo } from "./config/mongo";
import { seedDemoData } from "./services/demoSeed";

async function startServer() {
  const rawPort = process.env["PORT"];

  if (!rawPort) {
    throw new Error("PORT environment variable is required but was not provided.");
  }

  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  initializeFirebaseAdmin();
  await connectMongo();
  await seedDemoData();
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "ARTNEST API server listening");
  });
}

startServer().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  logger.error({ message }, "ARTNEST API startup failed");
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
