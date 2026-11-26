import Stripe from "stripe";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";

export type StoreId = "powerline" | "serverembassy" | "luckygirl";

const stripeClients = new Map<string, Stripe>();

export function resolveStore(rawStore?: string, origin?: string): StoreId {
  const storeStr = (rawStore || "").toLowerCase();
  const originStr = (origin || "").toLowerCase();

  if (storeStr.includes("luckygirl") || storeStr.includes("lucky_girl") || originStr.includes("luckygirl")) {
    return "luckygirl";
  }
  if (storeStr.includes("serverembassy") || storeStr.includes("server-embassy") || originStr.includes("serverembassy")) {
    return "serverembassy";
  }
  // Default to powerline for all Power Line Devices requests
  return "powerline";
}

export function getStripeConfig(storeId: StoreId = "powerline") {
  let secret: string | undefined;
  let publishableKey: string | undefined;
  let webhookSecret: string | undefined;

  if (storeId === "powerline") {
    secret =
      process.env.POWERLINE_STRIPE_SECRET_KEY ||
      process.env.STRIPE_SECRET_KEY_POWERLINE ||
      env.POWERLINE_STRIPE_SECRET_KEY ||
      process.env.STRIPE_SECRET_KEY ||
      env.STRIPE_SECRET_KEY;
    publishableKey =
      process.env.POWERLINE_STRIPE_PUBLISHABLE_KEY ||
      process.env.STRIPE_PUBLISHABLE_KEY_POWERLINE ||
      env.POWERLINE_STRIPE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
      process.env.STRIPE_PUBLISHABLE_KEY ||
      env.STRIPE_PUBLISHABLE_KEY ||
      "";
    webhookSecret =
      process.env.POWERLINE_STRIPE_WEBHOOK_SECRET ||
      process.env.STRIPE_WEBHOOK_SECRET_POWERLINE ||
      env.POWERLINE_STRIPE_WEBHOOK_SECRET ||
      process.env.STRIPE_WEBHOOK_SECRET ||
      env.STRIPE_WEBHOOK_SECRET;
  } else if (storeId === "serverembassy") {
    secret =
      process.env.SERVEREMBASSY_STRIPE_SECRET_KEY ||
      process.env.STRIPE_SECRET_KEY_SERVEREMBASSY ||
      env.SERVEREMBASSY_STRIPE_SECRET_KEY ||
      process.env.STRIPE_SECRET_KEY ||
      env.STRIPE_SECRET_KEY;
    publishableKey =
      process.env.SERVEREMBASSY_STRIPE_PUBLISHABLE_KEY ||
      process.env.STRIPE_PUBLISHABLE_KEY_SERVEREMBASSY ||
      env.SERVEREMBASSY_STRIPE_PUBLISHABLE_KEY ||
      process.env.STRIPE_PUBLISHABLE_KEY ||
      env.STRIPE_PUBLISHABLE_KEY ||
      "";
    webhookSecret =
      process.env.SERVEREMBASSY_STRIPE_WEBHOOK_SECRET ||
      process.env.STRIPE_WEBHOOK_SECRET_SERVEREMBASSY ||
      env.SERVEREMBASSY_STRIPE_WEBHOOK_SECRET ||
      process.env.STRIPE_WEBHOOK_SECRET ||
      env.STRIPE_WEBHOOK_SECRET;
  } else if (storeId === "luckygirl") {
    secret =
      process.env.LUCKYGIRL_STRIPE_SECRET_KEY ||
      process.env.STRIPE_SECRET_KEY_LUCKYGIRL ||
      env.LUCKYGIRL_STRIPE_SECRET_KEY ||
      process.env.STRIPE_SECRET_KEY ||
      env.STRIPE_SECRET_KEY;
    publishableKey =
      process.env.LUCKYGIRL_STRIPE_PUBLISHABLE_KEY ||
      process.env.STRIPE_PUBLISHABLE_KEY_LUCKYGIRL ||
      env.LUCKYGIRL_STRIPE_PUBLISHABLE_KEY ||
      process.env.STRIPE_PUBLISHABLE_KEY ||
      env.STRIPE_PUBLISHABLE_KEY ||
      "";
    webhookSecret =
      process.env.LUCKYGIRL_STRIPE_WEBHOOK_SECRET ||
      process.env.STRIPE_WEBHOOK_SECRET_LUCKYGIRL ||
      env.LUCKYGIRL_STRIPE_WEBHOOK_SECRET ||
      process.env.STRIPE_WEBHOOK_SECRET ||
      env.STRIPE_WEBHOOK_SECRET;
  }

  return { secret, publishableKey, webhookSecret };
}

export function getStripe(storeId: StoreId = "powerline"): Stripe {
  const config = getStripeConfig(storeId);
  if (!config.secret) {
    const storeLabel = storeId === "powerline" ? "Power Line Devices" : storeId === "serverembassy" ? "Server Embassy" : "Lucky Girl Scoops";
    throw new AppError(
      400,
      `Stripe payment is not configured on the server for ${storeLabel}. Please set ${storeId.toUpperCase()}_STRIPE_SECRET_KEY in .env, or select Wire / Bank Transfer at checkout.`,
    );
  }
  let client = stripeClients.get(config.secret);
  if (!client) {
    client = new Stripe(config.secret);
    stripeClients.set(config.secret, client);
  }
  return client;
}

export async function createPaymentIntent(
  amountInCents: number,
  currency = "usd",
  metadata: Record<string, string> = {},
  storeId: StoreId = "powerline",
) {
  const stripe = getStripe(storeId);
  const config = getStripeConfig(storeId);
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.max(50, Math.round(amountInCents)),
    currency: currency.toLowerCase(),
    automatic_payment_methods: { enabled: true },
    metadata: {
      ...metadata,
      store: storeId,
    },
  });
  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    publishableKey: config.publishableKey,
    store: storeId,
  };
}

export async function retrievePaymentIntent(
  paymentIntentId: string,
  storeId: StoreId = "powerline",
): Promise<{ status: string; amount: number; currency: string } | null> {
  try {
    const stripe = getStripe(storeId);
    return await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch (err) {
    console.error(`Failed to retrieve payment intent ${paymentIntentId} from Stripe (${storeId}):`, err);
    return null;
  }
}

export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
  endpointSecret: string,
  storeId: StoreId = "powerline",
): Stripe.Event {
  const stripe = getStripe(storeId);
  return stripe.webhooks.constructEvent(payload, signature, endpointSecret);
}

export async function refundPaymentIntent(
  paymentIntentId: string,
  storeId: StoreId = "powerline",
): Promise<boolean> {
  try {
    const stripe = getStripe(storeId);
    await stripe.refunds.create({ payment_intent: paymentIntentId });
    return true;
  } catch (err) {
    console.error(`Failed to refund payment intent ${paymentIntentId} (${storeId}):`, err);
    return false;
  }
}
