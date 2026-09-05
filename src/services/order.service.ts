import { Types } from "mongoose";
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
import * as couponService from "./coupon.service.js";

const ORDER_NUMBER_BASE = 1000;

async function initialOrderSeq() {
  const last = await Order.findOne({ orderNumber: /^SE-/ })
    .sort({ orderNumber: -1 })
    .select("orderNumber");
  const lastSeq = last ? Number(last.orderNumber.replace("SE-", "")) : ORDER_NUMBER_BASE;
  return Number.isFinite(lastSeq) ? lastSeq - ORDER_NUMBER_BASE : 0;
}

async function nextOrderNumber() {
  let counter = await Counter.findById("orderNumber");
  if (!counter) {
    const seq = await initialOrderSeq();
    try {
      counter = await Counter.create({ _id: "orderNumber", seq });
    } catch (e: unknown) {
      if ((e as { code?: number }).code !== 11000) throw e;
      counter = await Counter.findById("orderNumber");
    }
  }
  const updated = await Counter.findByIdAndUpdate("orderNumber", { $inc: { seq: 1 } }, { new: true });
  const seq = updated?.seq ?? counter?.seq ?? 0;
  return `SE-${String(ORDER_NUMBER_BASE + seq)}`;
}

export type CheckoutInput = {
  email: string;
  customerId?: string;
  paymentMethod: "card" | "paypal" | "wire" | "purchase_order" | "net_terms";
  shippingMethodCode?: string;
  couponCode?: string;
  billingAddress: Record<string, unknown>;
  shippingAddress: Record<string, unknown>;
  items: Array<{ productId: string; qty: number }>;
};

export async function createOrder(input: CheckoutInput) {
  if (!input.items.length) throw new AppError(400, "Cart is empty");

  const settings = await StoreSettings.findOne({ key: "default" });
  const threshold = settings?.freeShippingThreshold ?? 199;
  const taxRate = settings?.taxRate ?? 0.07;

  const productIds = input.items.map((i) => i.productId).filter(Types.ObjectId.isValid);
  const products = await Product.find({
    _id: { $in: productIds },
    status: "published",
  });

  if (products.length !== input.items.length) {
    throw new AppError(400, "One or more products are unavailable");
  }

  const productMap = new Map(products.map((p) => [String(p._id), p]));
  let subtotal = 0;

  const lineItems = input.items.map((item) => {
    const product = productMap.get(item.productId)!;
    if (product.stock < item.qty) {
      throw new AppError(400, `Insufficient stock for ${product.sku}`);
    }
    const unitPrice = product.price;
    const lineTotal = unitPrice * item.qty;
    subtotal += lineTotal;
    return {
      productId: product._id,
      sku: product.sku,
      title: product.title,
      qty: item.qty,
      unitPrice,
      lineTotal,
      weightLbs: product.weightLbs,
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
      const result = await Product.updateOne(
        { _id: item.productId, status: "published", stock: { $gte: item.qty } },
        { $inc: { stock: -item.qty } },
      );
      if (result.modifiedCount === 0) {
        throw new AppError(400, `Insufficient stock for ${productMap.get(item.productId)?.sku ?? item.productId}`);
      }
      decremented.set(item.productId, (decremented.get(item.productId) ?? 0) + item.qty);
    }

    const order = await Order.create({
      orderNumber: await nextOrderNumber(),
      customerId: input.customerId && Types.ObjectId.isValid(input.customerId) ? input.customerId : undefined,
      email: input.email,
      paymentMethod: input.paymentMethod,
      shippingMethodCode: input.shippingMethodCode,
      couponCode: input.couponCode,
      subtotal,
      discount,
      shippingCost,
      tax,
      total,
      billingAddress: input.billingAddress,
      shippingAddress: input.shippingAddress,
      items: lineItems,
    });

    if (input.couponCode) await couponService.redeemCoupon(input.couponCode);

    return mapDoc(order);
  } catch (e) {
    for (const [productId, qty] of decremented) {
      await Product.updateOne({ _id: productId }, { $inc: { stock: qty } });
    }
    throw e;
  }
}

export async function listOrders(query: { page?: number; limit?: number; status?: OrderStatus }) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, query.limit ?? 20);
  const skip = (page - 1) * limit;
  const filter = query.status ? { status: query.status } : {};

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
  if (!Types.ObjectId.isValid(id)) throw new AppError(404, "Order not found");
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
  if (!Types.ObjectId.isValid(id)) throw new AppError(404, "Order not found");
  const doc = await Order.findByIdAndUpdate(id, { status }, { new: true });
  if (!doc) throw new AppError(404, "Order not found");
  return mapDoc(doc);
}

export async function addShipment(
  orderId: string,
  data: { carrier: string; trackingNumber: string },
) {
  if (!Types.ObjectId.isValid(orderId)) throw new AppError(404, "Order not found");
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

export async function listQuotes() {
  const docs = await Quote.find().sort({ createdAt: -1 });
  return docs.map((d) => mapDoc(d));
}

export async function createQuote(data: Record<string, unknown>) {
  const doc = await Quote.create(data);
  return mapDoc(doc);
}

export async function updateQuoteStatus(id: string, status: QuoteStatus) {
  if (!Types.ObjectId.isValid(id)) throw new AppError(404, "Quote not found");
  const doc = await Quote.findByIdAndUpdate(id, { status }, { new: true });
  if (!doc) throw new AppError(404, "Quote not found");
  return mapDoc(doc);
}

export async function listCustomers() {
  const docs = await Customer.find().sort({ createdAt: -1 });
  const withCounts = await Promise.all(
    docs.map(async (c) => {
      const orders = await Order.countDocuments({ customerId: c._id });
      return { ...mapDoc(c), orderCount: orders };
    }),
  );
  return withCounts;
}

export async function updateCustomerTaxExempt(id: string, taxExempt: TaxExemptStatus) {
  if (!Types.ObjectId.isValid(id)) throw new AppError(404, "Customer not found");
  const doc = await Customer.findByIdAndUpdate(id, { taxExempt }, { new: true });
  if (!doc) throw new AppError(404, "Customer not found");
  return mapDoc(doc);
}

export async function getDashboardStats() {
  const [productCount, orderCount, newQuotes, processingOrders] = await Promise.all([
    Product.countDocuments(),
    Order.countDocuments(),
    Quote.countDocuments({ status: "new" }),
    Order.countDocuments({ status: "processing" }),
  ]);

  const paid = await Order.aggregate([
    { $match: { paymentStatus: "paid" } },
    { $group: { _id: null, revenue: { $sum: "$total" } } },
  ]);

  return {
    productCount,
    orderCount,
    newQuotes,
    processingOrders,
    revenue: paid[0]?.revenue ?? 0,
  };
}
