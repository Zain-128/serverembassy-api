import { Router } from "express";
import { z } from "zod";
import { NewsletterSubscriber } from "../models/index.js";
import * as orderService from "../services/order.service.js";
import * as contactService from "../services/contact.service.js";
import * as stripeService from "../services/stripe.service.js";
import { validateBody } from "../middleware/validate.js";

const router = Router();

router.post(
  "/create-payment-intent",
  validateBody(
    z.object({
      amount: z.number().positive("Amount must be greater than 0"),
      currency: z.string().default("usd"),
      metadata: z.record(z.string()).optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const { amount, currency, metadata } = req.body;
      const amountInCents = Math.round(amount * 100);
      const store = (req.headers["x-store-origin"] as string) || metadata?.store || "serverembassy";
      const result = await stripeService.createPaymentIntent(amountInCents, currency, {
        store,
        ...metadata,
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/checkout",
  validateBody(
    z.object({
      email: z.string().email("Invalid email address"),
      customerId: z.string().optional(),
      paymentMethod: z.enum([
        "stripe",
        "cod",
        "card",
        "paypal",
        "wire",
        "purchase_order",
        "net_terms",
      ]),
      paymentIntentId: z.string().optional(),
      shippingMethodCode: z.string().optional(),
      couponCode: z.string().optional(),
      createAccount: z.boolean().optional(),
      password: z.string().optional(),
      store: z.string().optional(),
      type: z.string().optional(),
      tiktokUsername: z.string().optional(),
      channel: z.string().optional(),
      billingAddress: z.record(z.unknown()).optional().default({}),
      shippingAddress: z.record(z.unknown()).optional().default({}),
      items: z
        .array(
          z.object({
            productId: z.string().optional(),
            sku: z.string().optional(),
            title: z.string().optional(),
            price: z.number().optional(),
            unitPrice: z.number().optional(),
            qty: z.number().int().positive().optional(),
            quantity: z.number().int().positive().optional(),
            image: z.string().optional(),
            selectedOption: z.string().optional(),
          }),
        )
        .min(1, "Cart cannot be empty"),
    }),
  ),
  async (req, res, next) => {
    try {
      const storeOrigin =
        req.body.type || req.body.store || (req.headers["x-store-type"] as string) || (req.headers["x-store-origin"] as string) || "serverembassy";
      const order = await orderService.createOrder({
        ...req.body,
        store: storeOrigin,
        type: storeOrigin,
      });
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
      store: z.string().optional(),
      type: z.string().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const storeOrigin =
        req.body.type || req.body.store || (req.headers["x-store-type"] as string) || (req.headers["x-store-origin"] as string) || "serverembassy";
      const quote = await orderService.createQuote({
        ...req.body,
        store: storeOrigin,
        type: storeOrigin,
      });
      res.status(201).json(quote);
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/newsletter",
  validateBody(z.object({ email: z.string().email(), store: z.string().optional(), type: z.string().optional() })),
  async (req, res, next) => {
    try {
      const email = req.body.email.toLowerCase();
      const store =
        req.body.type || req.body.store || (req.headers["x-store-type"] as string) || (req.headers["x-store-origin"] as string) || "serverembassy";
      const sub = await NewsletterSubscriber.findOneAndUpdate(
        { email },
        { email, store, type: store, unsubscribedAt: null, subscribedAt: new Date() },
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
      store: z.string().optional(),
      type: z.string().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const storeOrigin =
        req.body.type || req.body.store || (req.headers["x-store-type"] as string) || (req.headers["x-store-origin"] as string) || "serverembassy";
      const message = await contactService.createContactMessage({
        ...req.body,
        store: storeOrigin,
        type: storeOrigin,
      });
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
