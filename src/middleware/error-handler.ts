import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Not found" });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message, code: err.code });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      details: err.flatten().fieldErrors,
    });
  }

  // Handle Mongoose Duplicate Key Error (E11000)
  if (err && typeof err === "object" && (err as { code?: number }).code === 11000) {
    const keyValue = (err as { keyValue?: Record<string, string> }).keyValue;
    const keyStr = keyValue ? Object.keys(keyValue).join(", ") : "field";
    return res.status(400).json({
      error: `A record with this ${keyStr} already exists.`,
    });
  }

  // Handle Mongoose ValidationError
  if (err && typeof err === "object" && (err as { name?: string }).name === "ValidationError") {
    return res.status(400).json({
      error: (err as { message?: string }).message ?? "Validation failed",
    });
  }

  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
}
