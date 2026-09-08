import { Schema, model, type InferSchemaType, Types } from "mongoose";

export const STAFF_ROLES = [
  "super_admin",
  "admin",
  "catalog",
  "sales",
  "finance",
  "content",
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const PRODUCT_CONDITIONS = ["new", "certified_refurbished", "used"] as const;
export type ProductCondition = (typeof PRODUCT_CONDITIONS)[number];

export const PUBLISH_STATUSES = ["draft", "published", "archived"] as const;
export type PublishStatus = (typeof PUBLISH_STATUSES)[number];

export const ORDER_STATUSES = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const QUOTE_STATUSES = ["new", "contacted", "quoted", "won", "lost"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const TAX_EXEMPT_STATUSES = ["none", "pending", "approved", "rejected"] as const;
export type TaxExemptStatus = (typeof TAX_EXEMPT_STATUSES)[number];

export const COUPON_TYPES = ["percent", "fixed"] as const;
export type CouponType = (typeof COUPON_TYPES)[number];

const staffUserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, default: "" },
    role: { type: String, enum: STAFF_ROLES, default: "catalog" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const storeSettingsSchema = new Schema(
  {
    key: { type: String, default: "default", unique: true },
    storeName: { type: String, default: "Power Line Devices" },
    tagline: String,
    phone: String,
    supportEmail: String,
    address: String,
    hours: String,
    freeShippingThreshold: { type: Number, default: 199 },
    freeShippingLabel: { type: String, default: "Free shipping on orders over $199" },
    taxRate: { type: Number, default: 0.07 },
    currency: { type: String, default: "USD" },
  },
  { timestamps: true },
);

const brandSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, index: true },
    logoUrl: String,
    featured: { type: Boolean, default: false, index: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const categorySchema = new Schema(
  {
    parentId: { type: Schema.Types.ObjectId, ref: "Category", default: null, index: true },
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    bannerTitle: String,
    bannerSubtitle: String,
    bannerImageUrl: String,
    icon: { type: String, default: "network" },
    showOnHomepage: { type: Boolean, default: false, index: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const productImageSchema = new Schema(
  {
    url: { type: String, required: true },
    altText: String,
    sortOrder: { type: Number, default: 0 },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: true },
);

const productSchema = new Schema(
  {
    sku: { type: String, required: true, unique: true, index: true },
    slug: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, index: true },
    brandId: { type: Schema.Types.ObjectId, ref: "Brand", required: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true, index: true },
    description: { type: String, default: "" },
    features: { type: [String], default: [] },
    specs: { type: [{ label: String, value: String }], default: [] },
    condition: { type: String, enum: PRODUCT_CONDITIONS, default: "new" },
    warranty: { type: String, default: "30 Days" },
    price: { type: Number, required: true, min: 0, index: true },
    compareAtPrice: { type: Number, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    weightLbs: { type: Number, default: 1, min: 0 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    featured: { type: Boolean, default: false, index: true },
    isDeal: { type: Boolean, default: false, index: true },
    dealEndsAt: Date,
    status: { type: String, enum: PUBLISH_STATUSES, default: "draft", index: true },
    images: { type: [productImageSchema], default: [] },
    link: { type: String, default: "" },
    gtin: { type: String, default: "", index: true },
    mpn: { type: String, default: "", index: true },
    googleProductCategory: { type: String, default: "" },
    customLabel0: { type: String, default: "" },
    shipping: { type: String, default: "" },
    tax: { type: String, default: "" },
  },
  { timestamps: true },
);

productSchema.index({ title: "text", sku: "text", description: "text" });
productSchema.index({ status: 1, featured: 1, createdAt: -1 });

const bannerSchema = new Schema(
  {
    title: { type: String, required: true },
    subtitle: { type: String, default: "" },
    ctaLabel: { type: String, default: "Shop Now" },
    href: { type: String, required: true },
    imageUrl: String,
    size: { type: String, enum: ["hero", "half", "third"], default: "half" },
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true, index: true },
    startsAt: Date,
    endsAt: Date,
  },
  { timestamps: true },
);

const cmsPageSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    published: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const orderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product" },
    sku: { type: String, required: true },
    title: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true },
    lineTotal: { type: Number, required: true },
    weightLbs: { type: Number, default: 0 },
  },
  { _id: true },
);

const shipmentSchema = new Schema(
  {
    carrier: { type: String, required: true },
    trackingNumber: { type: String, required: true },
    shippedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    email: { type: String, required: true, index: true },
    status: { type: String, enum: ORDER_STATUSES, default: "pending", index: true },
    paymentStatus: {
      type: String,
      enum: ["pending", "authorized", "paid", "failed", "refunded"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["card", "paypal", "wire", "purchase_order", "net_terms"],
    },
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    shippingCost: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    couponCode: String,
    shippingMethodCode: String,
    billingAddress: { type: Schema.Types.Mixed, default: {} },
    shippingAddress: { type: Schema.Types.Mixed, default: {} },
    notes: String,
    items: { type: [orderItemSchema], default: [] },
    shipments: { type: [shipmentSchema], default: [] },
    placedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

const customerSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: String,
    fullName: { type: String, default: "" },
    company: String,
    phone: String,
    taxExempt: { type: String, enum: TAX_EXEMPT_STATUSES, default: "none" },
    taxExemptDocumentUrl: String,
    netTermsEnabled: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const quoteSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, index: true },
    phone: String,
    company: String,
    partNumber: String,
    quantity: Number,
    targetPrice: Number,
    message: String,
    status: { type: String, enum: QUOTE_STATUSES, default: "new", index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "StaffUser" },
  },
  { timestamps: true },
);

const newsletterSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    subscribedAt: { type: Date, default: Date.now },
    unsubscribedAt: Date,
  },
  { timestamps: false },
);

const contactMessageSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    subject: { type: String, default: "" },
    message: { type: String, required: true },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

const couponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    type: { type: String, enum: COUPON_TYPES, default: "percent", required: true },
    value: { type: Number, required: true, min: 0 },
    minSubtotal: { type: Number, default: 0, min: 0 },
    maxDiscount: { type: Number, min: 0 },
    expiresAt: Date,
    usageLimit: { type: Number, min: 0 },
    usedCount: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export type StaffUserDoc = InferSchemaType<typeof staffUserSchema>;
export type ProductDoc = InferSchemaType<typeof productSchema> & { _id: Types.ObjectId };

export const StaffUser = model("StaffUser", staffUserSchema);
export const StoreSettings = model("StoreSettings", storeSettingsSchema);
export const Brand = model("Brand", brandSchema);
export const Category = model("Category", categorySchema);
export const Product = model("Product", productSchema);
export const Banner = model("Banner", bannerSchema);
export const CmsPage = model("CmsPage", cmsPageSchema);
export const Order = model("Order", orderSchema);
export const Customer = model("Customer", customerSchema);
export const Quote = model("Quote", quoteSchema);
export const NewsletterSubscriber = model("NewsletterSubscriber", newsletterSchema);
export const ContactMessage = model("ContactMessage", contactMessageSchema);
export const Coupon = model("Coupon", couponSchema);
export const Counter = model("Counter", counterSchema);
