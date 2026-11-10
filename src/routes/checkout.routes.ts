import { Router } from "express";
import { z } from "zod";
import { NewsletterSubscriber } from "../models/index.js";
import * as orderService from "../services/order.service.js";
import * as contactService from "../services/contact.service.js";
import * as stripeService from "../services/stripe.service.js";
import { validateBody } from "../middleware/validate.js";
import { generateSignedUrl, verifySignedUrl } from "../lib/signedUrl.js";

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
      const orderNumber = (order as any).orderNumber || (order as any).id;
      const signedTrackingUrl = generateSignedUrl(`/api/orders/${orderNumber}/receipt`, {
        expiresInSeconds: 86400 * 7, // 7 days valid
        extraParams: { orderNumber, store: storeOrigin },
      });
      res.status(201).json({ ...order, signedTrackingUrl });
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
      const quoteId = (quote as any).id || (quote as any)._id || "quote";
      const signedQuoteUrl = generateSignedUrl(`/api/quotes/${quoteId}/view`, {
        expiresInSeconds: 86400 * 14, // 14 days valid
        extraParams: { quoteId: String(quoteId), email: req.body.email },
      });
      res.status(201).json({ ...quote, signedQuoteUrl });
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

router.get("/orders/verify-signed", async (req, res, next) => {
  try {
    const fullOriginalUrl = req.originalUrl;
    const verification = verifySignedUrl(fullOriginalUrl);
    if (!verification.valid) {
      return res.status(403).json({ error: verification.error || "Forbidden: Invalid or expired signed URL" });
    }
    const orderNumber = verification.params?.orderNumber;
    if (!orderNumber) {
      return res.status(400).json({ error: "Missing orderNumber in signed parameters" });
    }
    const order = await orderService.getOrderByOrderNumber(orderNumber);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json({ verified: true, order });
  } catch (e) {
    next(e);
  }
});

router.post(
  "/signed-urls/generate",
  validateBody(
    z.object({
      path: z.string().min(1),
      expiresInSeconds: z.number().int().positive().optional(),
      extraParams: z.record(z.any()).optional(),
    }),
  ),
  (req, res) => {
    const { path, expiresInSeconds, extraParams } = req.body;
    const signedUrl = generateSignedUrl(path, { expiresInSeconds, extraParams });
    res.json({ success: true, signedUrl });
  },
);

function mapSubscriber(doc: { _id: unknown; email: string }) {
  return { id: String(doc._id), email: doc.email };
}

export default router;
