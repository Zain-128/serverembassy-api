import { Router } from "express";
import { z } from "zod";
import { NewsletterSubscriber } from "../models/index.js";
import * as orderService from "../services/order.service.js";
import * as contactService from "../services/contact.service.js";
import { validateBody } from "../middleware/validate.js";

const router = Router();

router.post(
  "/checkout",
  validateBody(
    z.object({
      email: z.string().email(),
      customerId: z.string().optional(),
      paymentMethod: z.enum(["card", "paypal", "wire", "purchase_order", "net_terms"]),
      shippingMethodCode: z.string().optional(),
      couponCode: z.string().optional(),
      billingAddress: z.record(z.unknown()),
      shippingAddress: z.record(z.unknown()),
      items: z
        .array(
          z.object({
            productId: z.string().min(1),
            qty: z.number().int().positive(),
          }),
        )
        .min(1),
    }),
  ),
  async (req, res, next) => {
    try {
      const order = await orderService.createOrder(req.body);
      res.status(201).json(order);
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/quotes",
  validateBody(
    z.object({
      name: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional(),
      company: z.string().optional(),
      partNumber: z.string().optional(),
      quantity: z.number().int().positive().optional(),
      targetPrice: z.number().positive().optional(),
      message: z.string().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const quote = await orderService.createQuote(req.body);
      res.status(201).json(quote);
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/newsletter",
  validateBody(z.object({ email: z.string().email() })),
  async (req, res, next) => {
    try {
      const email = req.body.email.toLowerCase();
      const sub = await NewsletterSubscriber.findOneAndUpdate(
        { email },
        { email, unsubscribedAt: null, subscribedAt: new Date() },
        { upsert: true, new: true },
      );
      res.status(201).json(mapSubscriber(sub));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/contact",
  validateBody(
    z.object({
      name: z.string().min(1),
      email: z.string().email(),
      subject: z.string().optional(),
      message: z.string().min(1),
    }),
  ),
  async (req, res, next) => {
    try {
      const message = await contactService.createContactMessage(req.body);
      res.status(201).json(message);
    } catch (e) {
      next(e);
    }
  },
);

function mapSubscriber(doc: { _id: unknown; email: string }) {
  return { id: String(doc._id), email: doc.email };
}

export default router;
