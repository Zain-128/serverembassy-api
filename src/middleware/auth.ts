import type { NextFunction, Request, Response } from "express";
import type { StaffRole } from "../models/index.js";
import { verifyToken, type JwtPayload } from "../lib/jwt.js";
import { AppError } from "../lib/errors.js";

declare global {
  namespace Express {
    interface Request {
      auth?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError(401, "Authentication required"));
  }
  try {
    req.auth = verifyToken(header.slice(7));
    next();
  } catch {
    next(new AppError(401, "Invalid or expired token"));
  }
}

export function requireStaff(roles?: StaffRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth || req.auth.type !== "staff") {
      return next(new AppError(403, "Staff access required"));
    }
    if (roles && !roles.includes(req.auth.role as StaffRole)) {
      return next(new AppError(403, "Insufficient permissions"));
    }
    next();
  };
}

export function requireCustomer(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth || req.auth.type !== "customer") {
    return next(new AppError(403, "Customer account required"));
  }
  next();
}
