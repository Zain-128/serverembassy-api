import { Types, isValidObjectId } from "mongoose";
import {
  Counter,
  Customer,
  Order,
  Product,
  Quote,
  StoreSettings,
  type OrderStatus,
  type QuoteStatus,
  type TaxExemptStatus,
} from "../models/index.js";
import { AppError, mapDoc } from "../lib/errors.js";
import { paginate, totalPagesOf, type PaginationQuery } from "../lib/paginate.js";
import * as couponService from "./coupon.service.js";
import * as stripeService from "./stripe.service.js";

const ORDER_NUMBER_BASE = 1000;

export function normalizeStoreType(val?: string): string {
  if (!val) return "serverembassy";
  const lower = val.toLowerCase().trim();
  if (lower.includes("lucky") || lower.includes("scoop")) return "luckygirl";
  if (lower.includes("power")) return "powerline";
  if (lower.includes("embassy") || lower.includes("server")) return "serverembassy";
  return lower;
}

async function nextOrderNumber(store = "serverembassy") {
  const normStore = normalizeStoreType(store);
  const prefix = normStore === "luckygirl" ? "LGS" : normStore === "powerline" ? "PL" : "SE";
  const counterKey = `orderNumber_${prefix.toLowerCase()}`;

  let counter = await Counter.findById(counterKey);
  if (!counter) {
    const last = await Order.findOne({ orderNumber: new RegExp(`^${prefix}-`) })
      .sort({ orderNumber: -1 })
      .select("orderNumber");
    const lastSeq = last ? Number(last.orderNumber.replace(`${prefix}-`, "")) : ORDER_NUMBER_BASE;
    const initialSeq = Number.isFinite(lastSeq) ? lastSeq - ORDER_NUMBER_BASE : 0;
    try {
      counter = await Counter.create({ _id: counterKey, seq: initialSeq });
    } catch (e: unknown) {
      if ((e as { code?: number }).code !== 11000) throw e;
      counter = await Counter.findById(counterKey);
    }
  }
  const updated = await Counter.findByIdAndUpdate(counterKey, { $inc: { seq: 1 } }, { new: true });
  const seq = updated?.seq ?? counter?.seq ?? 0;
  return `${prefix}-${String(ORDER_NUMBER_BASE + seq)}`;
}

export type CheckoutInput = {
  email?: string;
  customerEmail?: string;
  customerId?: string;
  paymentMethod: "stripe" | "cod" | "card" | "paypal" | "wire" | "purchase_order" | "net_terms";
  paymentIntentId?: string;
  shippingMethodCode?: string;
  couponCode?: string;
  createAccount?: boolean;
  password?: string;
  billingAddress?: Record<string, unknown>;
  shippingAddress?: Record<string, unknown>;
  items: Array<{
    productId?: string;
    sku?: string;
    title?: string;
    price?: number;
    unitPrice?: number;
    qty?: number;
    quantity?: number;
    weightLbs?: number;
    image?: string;
    selectedOption?: string;
  }>;
  store?: string;
  type?: string;
  tiktokUsername?: string;
  channel?: string;
};

export async function createOrder(input: CheckoutInput) {
  if (!input.items || !input.items.length) throw new AppError(400, "Cart is empty");

  const email = (input.email || input.customerEmail || "").toLowerCase().trim();
  if (!email) throw new AppError(400, "Email is required");

  const rawStore = input.type || input.store || "serverembassy";
  const storeType = normalizeStoreType(rawStore);

  const settings = await StoreSettings.findOne({ key: "default" });
  const threshold = settings?.freeShippingThreshold ?? 199;
  const taxRate = settings?.taxRate ?? 0.07;

  // Separate items into mongo-managed items vs direct items
  const validMongoIds = input.items
    .map((i) => i.productId)
    .filter((id): id is string => Boolean(id && isValidObjectId(id)));

  const products = validMongoIds.length
    ? await Product.find({ _id: { $in: validMongoIds }, status: "published" })
    : [];
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  let subtotal = 0;
  const lineItems = input.items.map((item, idx) => {
    const qty = Math.max(1, Number(item.qty ?? item.quantity) || 1);
    let unitPrice = 0;
    let title = item.title || `Item ${idx + 1}`;
    let sku = item.sku || `SKU-${Date.now()}-${idx + 1}`;
    let productId: Types.ObjectId | undefined = undefined;
    let weightLbs = item.weightLbs || 0;
    const image = item.image || "";
    const selectedOption = item.selectedOption || "";

    if (item.productId && isValidObjectId(item.productId) && productMap.has(item.productId)) {
      const p = productMap.get(item.productId)!;
      unitPrice = p.price;
      title = p.title;
      sku = p.sku;
      productId = p._id;
      weightLbs = p.weightLbs || 0;
    } else {
      unitPrice = typeof item.price === "number" ? item.price : Number(item.unitPrice) || 0;
    }

    const lineTotal = unitPrice * qty;
    subtotal += lineTotal;
    return {
      productId,
      sku,
      title,
      qty,
      unitPrice,
      lineTotal,
      weightLbs,
      image,
      selectedOption,
    };
  });

  const shippingCost = subtotal >= threshold ? 0 : 14.99;

  let discount = 0;
  if (input.couponCode) {
    const validated = await couponService.validateCoupon(input.couponCode, subtotal);
    discount = validated.discount;
  }
  const tax = (subtotal - discount) * taxRate;
  const total = subtotal - discount + shippingCost + tax;

  const decremented = new Map<string, number>();

  try {
    for (const item of input.items) {
      if (item.productId && isValidObjectId(item.productId) && productMap.has(item.productId)) {
        const qty = Math.max(1, Number(item.qty ?? item.quantity) || 1);
        const result = await Product.updateOne(
          { _id: item.productId, status: "published", stock: { $gte: qty } },
          { $inc: { stock: -qty } },
        );
        if (result.modifiedCount === 0) {
          throw new AppError(400, `Insufficient stock for ${productMap.get(item.productId)?.sku ?? item.productId}`);
        }
        decremented.set(item.productId, (decremented.get(item.productId) ?? 0) + qty);
      }
    }

    const expectedAmountInCents = Math.round(total * 100);
    let paymentStatus: "paid" | "authorized" | "pending" = "pending";
    if (input.paymentMethod === "stripe" || input.paymentMethod === "card") {
      if (input.paymentIntentId) {
        const intent = await stripeService.retrievePaymentIntent(input.paymentIntentId);
        const isAmountValid =
          intent &&
          intent.amount >= expectedAmountInCents &&
          intent.currency.toLowerCase() === "usd";

        if (intent && intent.status === "succeeded" && isAmountValid) {
          paymentStatus = "paid";
        } else if (intent && intent.status === "requires_capture" && isAmountValid) {
          paymentStatus = "authorized";
        } else {
          paymentStatus = "pending";
        }
      } else {
        paymentStatus = "pending";
      }
    }

    const order = await Order.create({
      orderNumber: await nextOrderNumber(storeType),
      customerId: input.customerId && isValidObjectId(input.customerId) ? input.customerId : undefined,
      email,
      paymentMethod: input.paymentMethod,
      paymentStatus,
      paymentIntentId: input.paymentIntentId ?? "",
      shippingMethodCode: input.shippingMethodCode,
      couponCode: input.couponCode,
      subtotal,
      discount,
      shippingCost,
      tax,
      total,
      billingAddress: input.billingAddress || {},
      shippingAddress: input.shippingAddress || {},
      items: lineItems,
      store: storeType,
      type: storeType,
      tiktokUsername: (input.tiktokUsername || "").replace("@", ""),
      channel: input.channel || (storeType === "luckygirl" ? "TikTok Live" : "web"),
    });

    if (input.createAccount && input.password && !order.customerId) {
      try {
        const existing = await Customer.findOne({ email });
        if (!existing) {
          const bcryptModule = await import("bcryptjs");
          const bcryptLib = (bcryptModule as any).default || bcryptModule;
          const passwordHash = await bcryptLib.hash(input.password, 10);
          const fullName = `${(input.billingAddress as Record<string, string>)?.firstName ?? ""} ${(input.billingAddress as Record<string, string>)?.lastName ?? ""}`.trim();
          const newCust = await Customer.create({
            email,
            passwordHash,
            fullName,
            store: storeType,
            type: storeType,
          });
          order.customerId = newCust._id;
          await order.save();
        }
      } catch (err) {
        console.warn("Auto-create customer notice:", err);
      }
    }

    if (input.couponCode) await couponService.redeemCoupon(input.couponCode);

    return mapDoc(order);
  } catch (e) {
    for (const [productId, qty] of Array.from(decremented.entries())) {
      await Product.updateOne({ _id: productId }, { $inc: { stock: qty } });
    }
    throw e;
  }
}

export async function listOrders(query: {
  page?: number;
  limit?: number;
  status?: OrderStatus;
  store?: string;
  type?: string;
  q?: string;
}) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, query.limit ?? 20);
  const skip = (page - 1) * limit;

  const andClauses: Record<string, unknown>[] = [];
  if (query.status) andClauses.push({ status: query.status });

  const target = query.type || query.store;
  if (target && target !== "all") {
    const norm = normalizeStoreType(target);
    andClauses.push({
      $or: [{ store: norm }, { type: norm }, { store: target }, { type: target }],
    });
  }

  if (query.q) {
    const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    andClauses.push({
      $or: [
        { orderNumber: { $regex: escaped, $options: "i" } },
        { customerEmail: { $regex: escaped, $options: "i" } },
        { "shippingAddress.name": { $regex: escaped, $options: "i" } },
      ],
    });
  }

  const filter = andClauses.length > 1 ? { $and: andClauses } : andClauses[0] || {};

  const [docs, total] = await Promise.all([
    Order.find(filter).sort({ placedAt: -1 }).skip(skip).limit(limit),
    Order.countDocuments(filter),
  ]);

  return {
    items: docs.map((d) => mapDoc(d)),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getOrder(id: string) {
  if (!isValidObjectId(id)) throw new AppError(404, "Order not found");
  const doc = await Order.findById(id);
  if (!doc) throw new AppError(404, "Order not found");
  return mapDoc(doc);
}

export async function listCustomerOrders(customerId: string, query: { page?: number; limit?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, query.limit ?? 20);
  const skip = (page - 1) * limit;
  const filter = { customerId };

  const [docs, total] = await Promise.all([
    Order.find(filter).sort({ placedAt: -1 }).skip(skip).limit(limit),
    Order.countDocuments(filter),
  ]);

  return {
    items: docs.map((d) => mapDoc(d)),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  if (!isValidObjectId(id)) throw new AppError(404, "Order not found");
  const doc = await Order.findByIdAndUpdate(id, { status }, { new: true });
  if (!doc) throw new AppError(404, "Order not found");
  return mapDoc(doc);
}

export async function addShipment(
  orderId: string,
  data: { carrier: string; trackingNumber: string },
) {
  if (!isValidObjectId(orderId)) throw new AppError(404, "Order not found");
  const doc = await Order.findByIdAndUpdate(
    orderId,
    {
      $push: { shipments: { ...data, shippedAt: new Date() } },
      status: "shipped",
    },
    { new: true },
  );
  if (!doc) throw new AppError(404, "Order not found");
  return mapDoc(doc);
}

export async function listQuotes(filterParam?: { store?: string; type?: string }) {
  const filter: Record<string, unknown> = {};
  const target = filterParam?.type || filterParam?.store;
  if (target && target !== "all") {
    const norm = normalizeStoreType(target);
    filter.$or = [{ store: norm }, { type: norm }, { store: target }, { type: target }];
  }
  const docs = await Quote.find(filter).sort({ createdAt: -1 });
  return docs.map((d) => mapDoc(d));
}

export async function listQuotesPaginated(query: PaginationQuery & { store?: string; type?: string }) {
  const { page, limit, skip } = paginate(query);
  const filter: Record<string, unknown> = {};
  const target = query.type || query.store;
  if (target && target !== "all") {
    const norm = normalizeStoreType(target);
    filter.$or = [{ store: norm }, { type: norm }, { store: target }, { type: target }];
  }
  const [docs, total] = await Promise.all([
    Quote.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Quote.countDocuments(filter),
  ]);
  return {
    items: docs.map((d) => mapDoc(d)),
    total,
    page,
    limit,
    totalPages: totalPagesOf(total, limit),
  };
}

export async function createQuote(data: Record<string, unknown>) {
  const doc = await Quote.create(data);
  return mapDoc(doc);
}

export async function updateQuoteStatus(id: string, status: QuoteStatus) {
  if (!isValidObjectId(id)) throw new AppError(404, "Quote not found");
  const doc = await Quote.findByIdAndUpdate(id, { status }, { new: true });
  if (!doc) throw new AppError(404, "Quote not found");
  return mapDoc(doc);
}

export async function listCustomers(filterParam?: { store?: string; type?: string }) {
  const filter: Record<string, unknown> = {};
  const target = filterParam?.type || filterParam?.store;
  if (target && target !== "all") {
    const norm = normalizeStoreType(target);
    filter.$or = [{ store: norm }, { type: norm }, { store: target }, { type: target }];
  }
  const docs = await Customer.find(filter).select("-passwordHash").sort({ createdAt: -1 });
  const withCounts = await Promise.all(
    docs.map(async (c) => {
      const orders = await Order.countDocuments({ customerId: c._id });
      return { ...mapDoc(c), orderCount: orders };
    }),
  );
  return withCounts;
}

export async function listCustomersPaginated(query: PaginationQuery & { store?: string; type?: string }) {
  const { page, limit, skip } = paginate(query);
  const filter: Record<string, unknown> = {};
  const target = query.type || query.store;
  if (target && target !== "all") {
    const norm = normalizeStoreType(target);
    filter.$or = [{ store: norm }, { type: norm }, { store: target }, { type: target }];
  }
  const [docs, total] = await Promise.all([
    Customer.find(filter).select("-passwordHash").sort({ createdAt: -1 }).skip(skip).limit(limit),
    Customer.countDocuments(filter),
  ]);
  const withCounts = await Promise.all(
    docs.map(async (c) => {
      const orders = await Order.countDocuments({ customerId: c._id });
      return { ...mapDoc(c), orderCount: orders };
    }),
  );
  return {
    items: withCounts,
    total,
    page,
    limit,
    totalPages: totalPagesOf(total, limit),
  };
}

export async function updateCustomerTaxExempt(id: string, taxExempt: TaxExemptStatus) {
  if (!isValidObjectId(id)) throw new AppError(404, "Customer not found");
  const doc = await Customer.findByIdAndUpdate(id, { taxExempt }, { new: true }).select("-passwordHash");
  if (!doc) throw new AppError(404, "Customer not found");
  return mapDoc(doc);
}

export async function getDashboardStats(store?: string, type?: string) {
  const target = type || store;
  let storeFilter: Record<string, unknown> = {};
  if (target && target !== "all") {
    const norm = normalizeStoreType(target);
    storeFilter = { $or: [{ store: norm }, { type: norm }, { store: target }, { type: target }] };
  }

  const productFilter: Record<string, unknown> = { ...storeFilter };
  const orderFilter: Record<string, unknown> = { ...storeFilter };
  const quoteFilter: Record<string, unknown> = {
    status: "new",
    ...storeFilter,
  };

  const [productCount, orderCount, newQuotes, processingOrders] = await Promise.all([
    Product.countDocuments(productFilter),
    Order.countDocuments(orderFilter),
    Quote.countDocuments(quoteFilter),
    Order.countDocuments({ ...orderFilter, status: "processing" }),
  ]);

  const paidMatch: Record<string, unknown> = { paymentStatus: "paid", ...storeFilter };

  const paid = await Order.aggregate([
    { $match: paidMatch },
    { $group: { _id: null, revenue: { $sum: "$total" } } },
  ]);

  return {
    productCount,
    orderCount,
    newQuotes,
    processingOrders,
    revenue: paid[0]?.revenue ?? 0,
    store: target || "all",
    type: target || "all",
  };
}
