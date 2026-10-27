import { Router } from "express";
import { z } from "zod";
import * as authService from "../services/auth.service.js";
import { validateBody } from "../middleware/validate.js";
import { requireAuth, requireCustomer } from "../middleware/auth.js";

const router = Router();

router.post(
  "/login",
  validateBody(z.object({ email: z.string().email(), password: z.string().min(1) })),
  async (req, res, next) => {
    try {
      const result = await authService.loginStaff(req.body.email, req.body.password);
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await authService.getStaffProfile(req.auth!.sub);
    res.json(user);
  } catch (e) {
    next(e);
  }
});

router.post(
  "/register",
  validateBody(
    z.object({
      email: z.string().email(),
      password: z.string().min(6, "Password must be at least 6 characters"),
      fullName: z.string().optional(),
      company: z.string().optional(),
      phone: z.string().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      res.status(201).json(await authService.registerCustomer(req.body));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/customer/login",
  validateBody(z.object({ email: z.string().email(), password: z.string().min(1) })),
  async (req, res, next) => {
    try {
      res.json(await authService.loginCustomer(req.body.email, req.body.password));
    } catch (e) {
      next(e);
    }
  },
);

router.get("/customer/me", requireAuth, requireCustomer, async (req, res, next) => {
  try {
    res.json(await authService.getCustomerProfile(req.auth!.sub));
  } catch (e) {
    next(e);
  }
});

router.delete(
  "/customer/account",
  requireAuth,
  requireCustomer,
  validateBody(z.object({ password: z.string().min(1) })),
  async (req, res, next) => {
    try {
      res.json(await authService.deleteCustomer(req.auth!.sub, req.body.password));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/customer/invite",
  requireAuth,
  requireCustomer,
  validateBody(z.object({ email: z.string().email() })),
  async (req, res, next) => {
    try {
      res.status(201).json(await authService.sendInvite(req.auth!.sub, req.body.email));
    } catch (e) {
      next(e);
    }
  },
);

router.get("/customer/invites", requireAuth, requireCustomer, async (req, res, next) => {
  try {
    res.json(await authService.getMyInvites(req.auth!.sub));
  } catch (e) {
    next(e);
  }
});

export default router;
