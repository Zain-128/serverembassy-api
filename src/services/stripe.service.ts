import Stripe from "stripe";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new AppError(400, "Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-02-24.acacia" as any,
    });
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
    amount: Math.max(50, Math.round(amountInCents)), // Stripe min amount is 50 cents ($0.50)
    currency: currency.toLowerCase(),
    automatic_payment_methods: { enabled: true },
    metadata,
  });

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    publishableKey: env.STRIPE_PUBLISHABLE_KEY,
  };
}
