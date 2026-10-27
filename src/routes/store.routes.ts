import { Router } from "express";
import { z } from "zod";
import * as productService from "../services/product.service.js";
import * as catalogService from "../services/catalog.service.js";
import * as orderService from "../services/order.service.js";
import * as couponService from "../services/coupon.service.js";
import * as authService from "../services/auth.service.js";
import { validateQuery, validateBody } from "../middleware/validate.js";
import { requireAuth, requireCustomer } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";

const router = Router();

const listQuerySchema = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  q: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  inStock: z.coerce.boolean().optional(),
  featured: z.coerce.boolean().optional(),
  deal: z.coerce.boolean().optional(),
  sort: z.enum(["price_asc", "price_desc", "newest", "sku", "rating"]).optional(),
});

router.get(
  "/products",
  validateQuery(listQuerySchema),
  async (req, res, next) => {
    try {
      const q = req.query as z.infer<typeof listQuerySchema>;
      const result = await productService.listProducts(
        {
          page: q.page,
          limit: q.limit,
          q: q.q,
          categorySlug: q.category,
          brandSlug: q.brand,
          minPrice: q.minPrice,
          maxPrice: q.maxPrice,
          inStock: q.inStock,
          featured: q.featured,
          deal: q.deal,
          sort: q.sort,
        },
        true,
      );
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

router.get("/products/by-ids", validateQuery(z.object({ ids: z.string().optional() })), async (req, res, next) => {
  try {
    const ids = String(req.query.ids ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    res.json(await productService.getProductsByIds(ids, true));
  } catch (e) {
    next(e);
  }
});

router.get("/products/:slug", async (req, res, next) => {
  try {
    const product = await productService.getProductBySlug(req.params.slug, true);
    res.json(product);
  } catch (e) {
    next(e);
  }
});

router.get("/categories", async (_req, res, next) => {
  try {
    res.json(await catalogService.getCategoryTree());
  } catch (e) {
    next(e);
  }
});

router.get("/categories/homepage", async (_req, res, next) => {
  try {
    res.json(await catalogService.listCategories(true));
  } catch (e) {
    next(e);
  }
});

router.get("/categories/:slug", async (req, res, next) => {
  try {
    res.json(await catalogService.getCategoryBySlug(req.params.slug));
  } catch (e) {
    next(e);
  }
});

router.get("/brands", async (_req, res, next) => {
  try {
    res.json(await catalogService.listBrands(false));
  } catch (e) {
    next(e);
  }
});

router.get("/banners", async (_req, res, next) => {
  try {
    res.json(await catalogService.listBanners(true));
  } catch (e) {
    next(e);
  }
});

router.post(
  "/coupons/validate",
  validateBody(z.object({ code: z.string().min(1), subtotal: z.number().nonnegative() })),
  async (req, res, next) => {
    try {
      const { code, subtotal } = req.body;
      const { coupon, discount } = await couponService.validateCoupon(code, subtotal);
      res.json({
        valid: true,
        code: coupon.code,
        discount,
        type: coupon.type,
        value: coupon.value,
      });
    } catch (e) {
      if (e instanceof AppError) {
        res.json({ valid: false, error: e.message });
        return;
      }
      next(e);
    }
  },
);

router.get("/settings", async (_req, res, next) => {
  try {
    res.json(await catalogService.getStoreSettings());
  } catch (e) {
    next(e);
  }
});

router.get("/pages", async (_req, res, next) => {
  try {
    res.json(await catalogService.listCmsPages(true));
  } catch (e) {
    next(e);
  }
});

router.get("/pages/:slug", async (req, res, next) => {
  try {
    res.json(await catalogService.getCmsPageBySlug(req.params.slug));
  } catch (e) {
    next(e);
  }
});

const customerOrdersQuery = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
});

router.get(
  "/me/orders",
  requireAuth,
  requireCustomer,
  validateQuery(customerOrdersQuery),
  async (req, res, next) => {
    try {
      const q = req.query as z.infer<typeof customerOrdersQuery>;
      res.json(await orderService.listCustomerOrders(req.auth!.sub, { page: q.page, limit: q.limit }));
    } catch (e) {
      next(e);
    }
  },
);

router.get("/invite-leaderboard", async (_req, res, next) => {
  try {
    res.json(await authService.getInviteLeaderboard());
  } catch (e) {
    next(e);
  }
});

export default router;
