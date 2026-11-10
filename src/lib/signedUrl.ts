import crypto from "crypto";
import { env } from "../config/env.js";

const DEFAULT_SECRET = process.env.SIGNED_URL_SECRET || env.JWT_SECRET || "serverembassy-secure-signed-url-secret-2026-key";
const DEFAULT_EXPIRATION_SECONDS = 3600; // 1 hour

export interface SignUrlOptions {
  expiresInSeconds?: number;
  secret?: string;
  extraParams?: Record<string, string | number | boolean>;
}

export interface VerifyUrlResult {
  valid: boolean;
  expired: boolean;
  error?: string;
  pathname?: string;
  params?: Record<string, string>;
}

/**
 * Creates an HMAC-SHA256 signature for a path and its parameters
 */
function createSignature(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Generates a tamper-proof time-limited signed URL
 */
export function generateSignedUrl(
  pathOrUrl: string,
  options: SignUrlOptions = {}
): string {
  const secret = options.secret || DEFAULT_SECRET;
  const expiresIn = options.expiresInSeconds ?? DEFAULT_EXPIRATION_SECONDS;
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

  // Split path and existing query params
  const [basePath, existingQuery] = pathOrUrl.split("?");
  const searchParams = new URLSearchParams(existingQuery || "");

  // Add extra params if provided
  if (options.extraParams) {
    for (const [key, value] of Object.entries(options.extraParams)) {
      searchParams.set(key, String(value));
    }
  }

  // Set expiry timestamp
  searchParams.set("exp", String(expiresAt));

  // Sort query params alphabetically for deterministic HMAC hash
  searchParams.sort();
  const canonicalQuery = searchParams.toString();
  const payloadToSign = `${basePath}?${canonicalQuery}`;

  const signature = createSignature(payloadToSign, secret);
  searchParams.set("sig", signature);

  return `${basePath}?${searchParams.toString()}`;
}

/**
 * Verifies that a signed URL is authentic, untampered, and not expired
 */
export function verifySignedUrl(
  fullUrlOrPath: string,
  secret: string = DEFAULT_SECRET
): VerifyUrlResult {
  try {
    const [pathname, queryString] = fullUrlOrPath.split("?");
    if (!queryString) {
      return { valid: false, expired: false, error: "Missing signature parameters" };
    }

    const searchParams = new URLSearchParams(queryString);
    const providedSig = searchParams.get("sig");
    const expStr = searchParams.get("exp");

    if (!providedSig || !expStr) {
      return { valid: false, expired: false, error: "Missing signature or expiration" };
    }

    const expiresAt = parseInt(expStr, 10);
    if (isNaN(expiresAt)) {
      return { valid: false, expired: false, error: "Invalid expiration format" };
    }

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (now > expiresAt) {
      return { valid: false, expired: true, error: "Signed URL has expired" };
    }

    // Reconstruct canonical payload without 'sig'
    searchParams.delete("sig");
    searchParams.sort();
    const canonicalPayload = `${pathname}?${searchParams.toString()}`;

    const expectedSig = createSignature(canonicalPayload, secret);

    // Timing-safe comparison to prevent timing attacks
    const providedBuffer = Buffer.from(providedSig, "hex");
    const expectedBuffer = Buffer.from(expectedSig, "hex");

    if (
      providedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      return { valid: false, expired: false, error: "Invalid signature: URL tampered" };
    }

    // Extract all verified params
    const params: Record<string, string> = {};
    searchParams.forEach((val, key) => {
      params[key] = val;
    });

    return { valid: true, expired: false, pathname, params };
  } catch (err: any) {
    return { valid: false, expired: false, error: err.message || "Verification failed" };
  }
}
