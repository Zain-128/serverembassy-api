import { Router, Request, Response, NextFunction } from "express";
import { Product, Order } from "../models/index.js";

const router = Router();

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function checkAgentAuth(req: Request): boolean {
  const expectedKey = process.env.AGENT_STUDIO_API_KEY;
  if (!expectedKey || expectedKey.trim().length < 16) {
    return false;
  }
  const apiKey = req.headers["x-api-key"] as string | undefined;
  const authHeader = req.headers["authorization"] as string | undefined;

  if (apiKey && apiKey === expectedKey) {
    return true;
  }
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token === expectedKey) {
      return true;
    }
  }
  return false;
}

// Scoped CORS: restrict to official domains and configured AI Studio origin
router.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin) {
    const cleanOrigin = origin.replace(/\/$/, "").toLowerCase();
    const allowed = new Set(
      [
        "https://powerlinedevices.com",
        "https://www.powerlinedevices.com",
        "https://serverembassy.com",
        "https://www.serverembassy.com",
        process.env.AI_STUDIO_ORIGIN?.replace(/\/$/, "").toLowerCase(),
      ].filter(Boolean)
    );

    if (allowed.has(cleanOrigin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");
    }
  }
  next();
});

router.options(["/products/lookup", "/orders/track", "/agent/product", "/agent/order"], (_req: Request, res: Response) => {
  res.status(204).end();
});

/**
 * Endpoint 1: GET /api/agent/product
 * Query: ?query=<name_or_sku>
 */
router.get("/agent/product", async (req: Request, res: Response) => {
  if (!checkAgentAuth(req)) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Invalid or missing API key. Provide 'x-api-key' or 'Authorization: Bearer <token>' header.",
    });
  }

  const rawQuery = (req.query.query as string | undefined)?.trim();
  if (!rawQuery) {
    return res.status(404).json({ success: false, message: "Not found" });
  }

  // Sanitize input to max 80 chars and escape regex characters to prevent ReDoS
  const cleanQuery = rawQuery.slice(0, 80);
  const safeRegex = escapeRegex(cleanQuery);

  try {
    const productDoc: any = await Product.findOne({
      $or: [
        { sku: cleanQuery },
        { sku: { $regex: safeRegex, $options: "i" } },
        { title: { $regex: safeRegex, $options: "i" } },
        { slug: cleanQuery.toLowerCase() },
      ],
    });

    if (productDoc) {
      const priceNum = Number(productDoc.salePrice || productDoc.price || 0);
      const units = Number(productDoc.stockQty ?? productDoc.stock ?? 0);
      const specs = `${productDoc.condition || "Enterprise Grade"} | ${productDoc.brandName || "Enterprise Hardware"} | 30-Day Warranty`;

      return res.status(200).json({
        success: true,
        found: true,
        data: {
          sku: productDoc.sku,
          name: productDoc.title,
          price: `$${priceNum.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
          inStock: units > 0,
          unitsAvailable: units,
          specs,
          dispatchTime: units > 0 ? "Same-day dispatch if ordered before 3 PM EST" : "Contact sales for lead time",
        },
      });
    }

    return res.status(404).json({ success: false, message: "Not found" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

/**
 * Endpoint 2: GET /api/products/lookup
 * Query: ?sku=<sku> or ?query=<query>
 */
router.get("/products/lookup", async (req: Request, res: Response) => {
  if (!checkAgentAuth(req)) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Invalid or missing API key. Provide 'x-api-key' or 'Authorization: Bearer <token>' header.",
    });
  }

  const sku = (req.query.sku as string | undefined)?.trim();
  const query = (req.query.query as string | undefined)?.trim();

  if (!sku && !query) {
    return res.status(400).json({
      success: false,
      found: false,
      message: "Either 'sku' or 'query' parameter is required for product lookup.",
    });
  }

  try {
    let productDoc: any = null;

    if (sku) {
      const cleanSku = sku.slice(0, 80);
      productDoc = await Product.findOne({
        $or: [{ sku: cleanSku }, { sku: { $regex: `^${escapeRegex(cleanSku)}$`, $options: "i" } }],
      });
    }

    if (!productDoc && query) {
      const cleanQuery = query.slice(0, 80);
      const safeRegex = escapeRegex(cleanQuery);
      productDoc = await Product.findOne({
        $or: [
          { sku: { $regex: safeRegex, $options: "i" } },
          { title: { $regex: safeRegex, $options: "i" } },
          { slug: cleanQuery.toLowerCase() },
        ],
      });
    }

    if (productDoc) {
      const p = productDoc;
      const units = Number(p.stockQty ?? p.stock ?? 0);
      const isAvailable = units > 0;
      const status = units > 5 ? "in_stock" : units > 0 ? "low_stock" : "out_of_stock";

      return res.status(200).json({
        success: true,
        found: true,
        product: {
          sku: p.sku,
          name: p.title,
          category: p.primaryCategorySlug ? p.primaryCategorySlug.replace(/-/g, " ") : "Enterprise Hardware",
          price: {
            currency: "USD",
            amount: Number(p.salePrice || p.price || 0),
            formatted: `$${Number(p.salePrice || p.price || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
          },
          stock: {
            isAvailable,
            unitsAvailable: units,
            status,
            warehouseLocation: "Orlando, FL Fulfillment Center",
          },
          specifications: {
            condition: p.condition || "Certified Refurbished",
            brand: p.brandName || "OEM",
            warranty: "30-Day Hardware Replacement Included",
          },
          leadTime: isAvailable ? "Same-day dispatch if ordered before 3 PM EST" : "Backorder / Contact sales",
        },
      });
    }

    return res.status(404).json({
      success: false,
      found: false,
      message: "Product with specified SKU or name not found in catalog.",
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

/**
 * Endpoint 3: GET /api/agent/order
 * Query: ?orderId=<order_id>&emailOrPhone=<email_or_phone>
 * 
 * Strict Security:
 * - Requires AGENT_STUDIO_API_KEY
 * - Requires email or phone verification
 * - Uses exact string lookup (no regex injection)
 * - Returns ONLY status & real tracking; NEVER customer name, company, items, or totals
 * - Never invents tracking details
 */
router.get("/agent/order", async (req: Request, res: Response) => {
  if (!checkAgentAuth(req)) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Invalid or missing API key. Provide 'x-api-key' or 'Authorization: Bearer <token>' header.",
    });
  }

  const rawOrderId = (req.query.orderId as string | undefined)?.trim();
  const rawVerify = ((req.query.emailOrPhone || req.query.email || req.query.phone) as string | undefined)?.trim().toLowerCase();

  if (!rawOrderId) {
    return res.status(400).json({ success: false, message: "Order ID parameter is required." });
  }

  // Require verification to prevent order enumeration
  if (!rawVerify || rawVerify.length < 4) {
    return res.status(400).json({
      success: false,
      message: "Customer email or phone verification is required to look up order status.",
    });
  }

  const cleanOrderId = rawOrderId.replace(/^#/, "");
  if (!/^[A-Za-z0-9\-_]+$/.test(cleanOrderId)) {
    return res.status(400).json({ success: false, message: "Invalid order ID format." });
  }

  try {
    // Exact match only: never regex
    const orderDoc: any = await Order.findOne({
      $or: [{ orderNumber: cleanOrderId }, { orderNumber: `#${cleanOrderId}` }],
    });

    if (!orderDoc) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    // Verify email or phone against database record
    const orderEmail = (orderDoc.email || "").toLowerCase().trim();
    const rawPhone = (orderDoc.shippingAddress?.phone || orderDoc.customerPhone || "").replace(/[^0-9]/g, "");
    const testDigits = rawVerify.replace(/[^0-9]/g, "");

    const emailMatches = orderEmail && rawVerify === orderEmail;
    const phoneMatches = testDigits.length >= 7 && rawPhone.endsWith(testDigits);

    if (!emailMatches && !phoneMatches) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    // Real shipment details only: never invent
    const shipment = orderDoc.shipments?.[0];
    const hasShipment = Boolean(shipment && shipment.trackingNumber);

    const rawStatus = (orderDoc.status || "processing").toLowerCase();
    let status = "Processing";
    if (rawStatus === "delivered") status = "Delivered";
    else if (rawStatus === "shipped") status = "Shipped";
    else if (rawStatus === "confirmed") status = "Confirmed";
    else if (rawStatus === "cancelled") status = "Cancelled";

    return res.status(200).json({
      success: true,
      found: true,
      data: {
        orderId: orderDoc.orderNumber,
        status: hasShipment ? "In Transit" : status,
        carrier: hasShipment ? (shipment.carrier || null) : null,
        trackingNumber: hasShipment ? (shipment.trackingNumber || null) : null,
        currentLocation: hasShipment ? (shipment.currentLocation || "In Transit") : "Not shipped yet",
        estimatedDelivery: hasShipment ? (shipment.estimatedDelivery || null) : null,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

/**
 * Endpoint 4: GET /api/orders/track
 * Query: ?orderId=<order_id>&emailOrPhone=<email_or_phone>
 * 
 * Strict Security:
 * - Requires AGENT_STUDIO_API_KEY
 * - Requires email or phone verification
 * - Exact string match only (no regex)
 * - Returns ONLY status & real tracking; NEVER customer name, company, items, or totals
 * - Never invents tracking details
 */
router.get("/orders/track", async (req: Request, res: Response) => {
  if (!checkAgentAuth(req)) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Invalid or missing API key. Provide 'x-api-key' or 'Authorization: Bearer <token>' header.",
    });
  }

  const rawOrderId = (req.query.orderId as string | undefined)?.trim();
  const rawVerify = ((req.query.emailOrPhone || req.query.email || req.query.phone) as string | undefined)?.trim().toLowerCase();

  if (!rawOrderId) {
    return res.status(400).json({
      success: false,
      found: false,
      message: "Query parameter 'orderId' is required.",
    });
  }

  // Require verification to prevent order enumeration
  if (!rawVerify || rawVerify.length < 4) {
    return res.status(400).json({
      success: false,
      found: false,
      message: "Customer email or phone verification is required to track orders.",
    });
  }

  const cleanOrderId = rawOrderId.replace(/^#/, "");
  if (!/^[A-Za-z0-9\-_]+$/.test(cleanOrderId)) {
    return res.status(400).json({
      success: false,
      found: false,
      message: "Invalid order ID format.",
    });
  }

  try {
    // Exact match only: never regex
    const orderDoc: any = await Order.findOne({
      $or: [{ orderNumber: cleanOrderId }, { orderNumber: `#${cleanOrderId}` }],
    });

    if (!orderDoc) {
      return res.status(404).json({
        success: false,
        found: false,
        message: "Order ID not found in system. Please verify the order number.",
      });
    }

    // Verify email or phone against database record
    const orderEmail = (orderDoc.email || "").toLowerCase().trim();
    const rawPhone = (orderDoc.shippingAddress?.phone || orderDoc.customerPhone || "").replace(/[^0-9]/g, "");
    const testDigits = rawVerify.replace(/[^0-9]/g, "");

    const emailMatches = orderEmail && rawVerify === orderEmail;
    const phoneMatches = testDigits.length >= 7 && rawPhone.endsWith(testDigits);

    if (!emailMatches && !phoneMatches) {
      return res.status(404).json({
        success: false,
        found: false,
        message: "Order not found. Please verify the order number and email/phone.",
      });
    }

    // Real shipment details only: never invent
    const shipment = orderDoc.shipments?.[0];
    const hasShipment = Boolean(shipment && shipment.trackingNumber);

    return res.status(200).json({
      success: true,
      found: true,
      order: {
        orderId: orderDoc.orderNumber,
        status: orderDoc.status || "processing",
        shipping: {
          status: hasShipment ? "Shipped" : "Not shipped yet",
          carrier: hasShipment ? (shipment.carrier || null) : null,
          trackingNumber: hasShipment ? (shipment.trackingNumber || null) : null,
          trackingUrl: hasShipment ? (shipment.trackingUrl || null) : null,
          currentLocation: hasShipment ? (shipment.currentLocation || "In Transit") : "Not shipped yet",
          estimatedDelivery: hasShipment ? (shipment.estimatedDelivery || null) : null,
        },
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;
