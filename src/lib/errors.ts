import type { Response } from "express";
import type { Types } from "mongoose";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function sendError(res: Response, status: number, message: string, code?: string) {
  return res.status(status).json({ error: message, code });
}

export function toId(value: Types.ObjectId | string) {
  return String(value);
}

export function mapDoc(doc: { _id: unknown; toObject?: () => Record<string, unknown> }) {
  const plain =
    typeof doc.toObject === "function" ? doc.toObject() : (doc as Record<string, unknown>);
  const { _id, ...rest } = plain;
  return { id: String(_id), ...rest };
}
