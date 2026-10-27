import Stripe from "stripe";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  const secret = process.env.STRIPE_SECRET_KEY || env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new AppError(
      400,
      "Stripe payment is not configured on the server. Please set STRIPE_SECRET_KEY in .env, or use Cash on Delivery (COD).",
    );
  }
  if (!stripeClient) {
    stripeClient = new Stripe(secret);
  }
  return stripeClient;
}

export async function createPaymentIntent(
  amountInCents: number,
  currency = "usd",
  metadata: Record<string, string> = {},
) {
  const stripe = getStripe();
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.max(50, Math.round(amountInCents)),
    currency: currency.toLowerCase(),
    automatic_payment_methods: { enabled: true },
    metadata,
  });
  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    publishableKey:
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
      process.env.STRIPE_PUBLISHABLE_KEY ||
      env.STRIPE_PUBLISHABLE_KEY ||
      "",
  };
}

export async function retrievePaymentIntent(paymentIntentId: string): Promise<{ status: string; amount: number; currency: string } | null> {
  try {
    const stripe = getStripe();
    return await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch (err) {
    console.error("Failed to retrieve payment intent from Stripe:", err);
    return null;
  }
}
