import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { StaffRole } from "../models/index.js";

export type JwtPayload = {
  sub: string;
  email: string;
  role: StaffRole | "customer";
  type: "staff" | "customer";
};

export function signToken(payload: Omit<JwtPayload, "type"> & { type?: JwtPayload["type"] }) {
  return jwt.sign(
    { ...payload, type: payload.type ?? "staff" },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] },
  );
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
