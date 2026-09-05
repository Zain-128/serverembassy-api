import { Coupon } from "../models/index.js";
import { AppError, mapDoc } from "../lib/errors.js";

export async function listCoupons() {
  const docs = await Coupon.find().sort({ createdAt: -1 });
  return docs.map(mapDoc);
}

export async function createCoupon(data: Record<string, unknown>) {
  if (typeof data.code === "string") data.code = data.code.toUpperCase().trim();
  const doc = await Coupon.create(data);
  return mapDoc(doc);
}

export async function updateCoupon(id: string, data: Record<string, unknown>) {
  if (!id.match(/^[0-9a-fA-F]{24}$/)) throw new AppError(404, "Coupon not found");
  if (typeof data.code === "string") data.code = data.code.toUpperCase().trim();
  const doc = await Coupon.findByIdAndUpdate(id, data, { new: true });
  if (!doc) throw new AppError(404, "Coupon not found");
  return mapDoc(doc);
}

export async function deleteCoupon(id: string) {
  if (!id.match(/^[0-9a-fA-F]{24}$/)) throw new AppError(404, "Coupon not found");
  const result = await Coupon.findByIdAndDelete(id);
  if (!result) throw new AppError(404, "Coupon not found");
}

export async function getCouponByCode(code: string) {
  const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() });
  if (!coupon) return null;
  return coupon;
}

export function computeDiscount(coupon: {
  type: "percent" | "fixed";
  value: number;
  maxDiscount?: number | null;
}, subtotal: number) {
  const raw = coupon.type === "percent" ? (subtotal * coupon.value) / 100 : coupon.value;
  const capped =
    coupon.maxDiscount != null ? Math.min(raw, coupon.maxDiscount) : raw;
  return Math.max(0, Math.min(capped, subtotal));
}

export async function validateCoupon(code: string, subtotal: number) {
  const coupon = await getCouponByCode(code);
  if (!coupon) throw new AppError(400, "Invalid coupon code");
  if (!coupon.active) throw new AppError(400, "Coupon is not active");
  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
    throw new AppError(400, "Coupon has expired");
  }
  if (coupon.minSubtotal > 0 && subtotal < coupon.minSubtotal) {
    throw new AppError(400, `Minimum subtotal of ${coupon.minSubtotal} required for this coupon`);
  }
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    throw new AppError(400, "Coupon usage limit reached");
  }
  return { coupon, discount: computeDiscount(coupon, subtotal) };
}

export async function redeemCoupon(code: string) {
  await Coupon.updateOne(
    { code: code.toUpperCase().trim(), active: true },
    { $inc: { usedCount: 1 } },
  );
}