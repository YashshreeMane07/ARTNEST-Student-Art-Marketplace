import type { ErrorRequestHandler, RequestHandler } from "express";
import mongoose from "mongoose";

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "NOT_FOUND", message: "That API route was not found." });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (res.headersSent) return;

  if (error instanceof mongoose.Error.ValidationError) {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: Object.values(error.errors).map((item) => item.message).join("; "),
    });
    return;
  }
  if (error instanceof mongoose.Error.CastError) {
    res.status(400).json({ error: "INVALID_ID", message: "The requested id is invalid." });
    return;
  }
  if ((error as { name?: string })?.name === "MulterError") {
    res.status(400).json({ error: "UPLOAD_ERROR", message: "The image could not be uploaded." });
    return;
  }

  const status =
    Number.isInteger((error as { status?: number })?.status) &&
    (error as { status: number }).status >= 400 &&
    (error as { status: number }).status < 600
      ? (error as { status: number }).status
      : 500;
  const code = (error as { code?: string })?.code || "INTERNAL_ERROR";
  const safeMessage =
    status < 500 && error instanceof Error ? error.message : "The server could not complete the request.";

  res.status(status).json({ error: code, message: safeMessage });
};

export function httpError(status: number, code: string, message: string) {
  return Object.assign(new Error(message), { status, code });
}
