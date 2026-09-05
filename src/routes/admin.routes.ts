import { Router } from "express";
import { z } from "zod";
import {
  PUBLISH_STATUSES,
  PRODUCT_CONDITIONS,
  ORDER_STATUSES,
  QUOTE_STATUSES,
  TAX_EXEMPT_STATUSES,
  COUPON_TYPES,
} from "../models/index.js";
import * as productService from "../services/product.service.js";
import * as catalogService from "../services/catalog.service.js";
import * as orderService from "../services/order.service.js";
import * as couponService from "../services/coupon.service.js";
import * as contactService from "../services/contact.service.js";
import { requireAuth, requireStaff } from "../middleware/auth.js";
import { validateBody, validateQuery } from "../middleware/validate.js";

const router = Router();

router.use(requireAuth, requireStaff());

router.get("/dashboard", async (_req, res, next) => {
  try {
    res.json(await orderService.getDashboardStats());
  } catch (e) {
    next(e);
  }
});

const productBody = z.object({
  sku: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  brandId: z.string().min(1),
  categoryId: z.string().min(1),
  description: z.string().optional(),
  features: z.array(z.string()).optional(),
  specs: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  condition: z.enum(PRODUCT_CONDITIONS).optional(),
  warranty: z.string().optional(),
  price: z.number().nonnegative(),
  compareAtPrice: z.number().nonnegative().nullable().optional(),
  stock: z.number().int().nonnegative().optional(),
  weightLbs: z.number().nonnegative().optional(),
  featured: z.boolean().optional(),
  isDeal: z.boolean().optional(),
  dealEndsAt: z.string().datetime().nullable().optional(),
  status: z.enum(PUBLISH_STATUSES).optional(),
  link: z.string().optional(),
  gtin: z.string().optional(),
  mpn: z.string().optional(),
  googleProductCategory: z.string().optional(),
  customLabel0: z.string().optional(),
  shipping: z.string().optional(),
  tax: z.string().optional(),
  images: z
    .array(
      z.object({
        url: z.string(),
        altText: z.string().optional(),
        sortOrder: z.number().optional(),
        isPrimary: z.boolean().optional(),
      }),
    )
    .optional(),
});

const categoryFields = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  parentId: z.string().nullable().optional(),
  description: z.string().optional(),
  bannerTitle: z.string().optional(),
  bannerSubtitle: z.string().optional(),
  bannerImageUrl: z.string().optional(),
  icon: z.string().optional(),
  showOnHomepage: z.boolean().optional(),
  sortOrder: z.number().optional(),
});
const categoryBody = categoryFields.partial();

const bannerFields = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  ctaLabel: z.string().optional(),
  href: z.string().min(1),
  imageUrl: z.string().optional(),
  size: z.enum(["hero", "half", "third"]).optional(),
  sortOrder: z.number().optional(),
  active: z.boolean().optional(),
});
const bannerBody = bannerFields.partial();

const settingsBody = z.object({
  storeName: z.string().optional(),
  tagline: z.string().optional(),
  phone: z.string().optional(),
  supportEmail: z.string().email().optional(),
  address: z.string().optional(),
  hours: z.string().optional(),
  freeShippingThreshold: z.number().nonnegative().optional(),
  freeShippingLabel: z.string().optional(),
  taxRate: z.number().nonnegative().max(1).optional(),
  currency: z.string().optional(),
});

const adminListQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  q: z.string().optional(),
});

const productListQuery = adminListQuery.extend({
  status: z.enum(PUBLISH_STATUSES).optional(),
});

const orderListQuery = adminListQuery.extend({
  status: z.enum(ORDER_STATUSES).optional(),
});

router.get(
  "/products",
  validateQuery(productListQuery),
  async (req, res, next) => {
    try {
      const q = req.query as z.infer<typeof productListQuery>;
      const result = await productService.listProducts(
        {
          page: q.page,
          limit: q.limit ?? 50,
          q: q.q,
          status: q.status,
        },
        false,
      );
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

router.get("/products/:id", async (req, res, next) => {
  try {
    res.json(await productService.getProductById(req.params.id as string));
  } catch (e) {
    next(e);
  }
});

router.post(
  "/products",
  requireStaff(["super_admin", "admin", "catalog"]),
  validateBody(productBody),
  async (req, res, next) => {
    try {
      const { dealEndsAt, ...rest } = req.body;
      const product = await productService.createProduct({
        ...rest,
        dealEndsAt: dealEndsAt ? new Date(dealEndsAt) : undefined,
      });
      res.status(201).json(product);
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/products/:id",
  requireStaff(["super_admin", "admin", "catalog"]),
  validateBody(productBody.partial()),
  async (req, res, next) => {
    try {
      const { dealEndsAt, ...rest } = req.body;
      const product = await productService.updateProduct(req.params.id as string, {
        ...rest,
        ...(dealEndsAt !== undefined
          ? { dealEndsAt: dealEndsAt ? new Date(dealEndsAt) : null }
          : {}),
      });
      res.json(product);
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/products/:id",
  requireStaff(["super_admin", "admin", "catalog"]),
  async (req, res, next) => {
    try {
      await productService.deleteProduct(req.params.id as string);
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/products/import",
  requireStaff(["super_admin", "admin", "catalog"]),
  validateBody(
    z.object({
      rows: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          description: z.string().optional(),
          link: z.string().optional(),
          price: z.union([z.string(), z.number()]).optional(),
          salePrice: z.union([z.string(), z.number()]).optional(),
          brand: z.string().optional(),
          condition: z.string().optional(),
          gtin: z.string().optional(),
          imageLink: z.string().optional(),
          mpn: z.string().optional(),
          productType: z.string().optional(),
          quantity: z.union([z.string(), z.number()]).optional(),
          shipping: z.string().optional(),
          tax: z.string().optional(),
          availability: z.string().optional(),
          googleProductCategory: z.string().optional(),
          shippingWeight: z.union([z.string(), z.number()]).optional(),
          customLabel0: z.string().optional(),
        }),
      ),
    }),
  ),
  async (req, res, next) => {
    try {
      res.json(await productService.bulkUpsertProducts(req.body.rows));
    } catch (e) {
      next(e);
    }
  },
);

router.get("/categories", async (_req, res, next) => {
  try {
    res.json(await catalogService.listCategories());
  } catch (e) {
    next(e);
  }
});

router.post(
  "/categories",
  requireStaff(["super_admin", "admin", "catalog"]),
  validateBody(categoryFields),
  async (req, res, next) => {
    try {
      res.status(201).json(await catalogService.createCategory(req.body));
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/categories/:id",
  requireStaff(["super_admin", "admin", "catalog"]),
  validateBody(categoryBody),
  async (req, res, next) => {
    try {
      res.json(await catalogService.updateCategory(req.params.id as string, req.body));
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/categories/:id",
  requireStaff(["super_admin", "admin", "catalog"]),
  async (req, res, next) => {
    try {
      await catalogService.deleteCategory(req.params.id as string);
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  },
);

router.get("/brands", async (_req, res, next) => {
  try {
    res.json(await catalogService.listBrands());
  } catch (e) {
    next(e);
  }
});

router.post(
  "/brands",
  requireStaff(["super_admin", "admin", "catalog"]),
  validateBody(
    z.object({
      slug: z.string(),
      name: z.string(),
      logoUrl: z.string().optional(),
      featured: z.boolean().optional(),
      sortOrder: z.number().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      res.status(201).json(await catalogService.createBrand(req.body));
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/orders",
  validateQuery(orderListQuery),
  async (req, res, next) => {
    try {
      const q = req.query as z.infer<typeof orderListQuery>;
      res.json(
        await orderService.listOrders({
          page: q.page,
          limit: q.limit ?? 20,
          ...(q.status ? { status: q.status } : {}),
        }),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.get("/orders/:id", async (req, res, next) => {
  try {
    res.json(await orderService.getOrder(req.params.id as string));
  } catch (e) {
    next(e);
  }
});

router.patch(
  "/orders/:id/status",
  requireStaff(["super_admin", "admin", "finance"]),
  validateBody(z.object({ status: z.enum(ORDER_STATUSES) })),
  async (req, res, next) => {
    try {
      res.json(await orderService.updateOrderStatus(req.params.id as string, req.body.status));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/orders/:id/shipments",
  requireStaff(["super_admin", "admin", "finance"]),
  validateBody(z.object({ carrier: z.string(), trackingNumber: z.string() })),
  async (req, res, next) => {
    try {
      res.json(await orderService.addShipment(req.params.id as string, req.body));
    } catch (e) {
      next(e);
    }
  },
);

router.get("/quotes", async (_req, res, next) => {
  try {
    res.json(await orderService.listQuotes());
  } catch (e) {
    next(e);
  }
});

router.patch(
  "/quotes/:id/status",
  requireStaff(["super_admin", "admin", "sales"]),
  validateBody(z.object({ status: z.enum(QUOTE_STATUSES) })),
  async (req, res, next) => {
    try {
      res.json(await orderService.updateQuoteStatus(req.params.id as string, req.body.status));
    } catch (e) {
      next(e);
    }
  },
);

router.get("/customers", async (_req, res, next) => {
  try {
    res.json(await orderService.listCustomers());
  } catch (e) {
    next(e);
  }
});

router.patch(
  "/customers/:id/tax-exempt",
  requireStaff(["super_admin", "admin", "sales"]),
  validateBody(z.object({ taxExempt: z.enum(TAX_EXEMPT_STATUSES) })),
  async (req, res, next) => {
    try {
      res.json(await orderService.updateCustomerTaxExempt(req.params.id as string, req.body.taxExempt));
    } catch (e) {
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

router.patch(
  "/settings",
  requireStaff(["super_admin", "admin"]),
  validateBody(settingsBody),
  async (req, res, next) => {
    try {
      res.json(await catalogService.updateStoreSettings(req.body));
    } catch (e) {
      next(e);
    }
  },
);

router.get("/banners", async (_req, res, next) => {
  try {
    res.json(await catalogService.listBanners());
  } catch (e) {
    next(e);
  }
});

router.post(
  "/banners",
  requireStaff(["super_admin", "admin", "content"]),
  validateBody(
    z.object({
      title: z.string(),
      subtitle: z.string().optional(),
      ctaLabel: z.string().optional(),
      href: z.string(),
      imageUrl: z.string().optional(),
      size: z.enum(["hero", "half", "third"]).optional(),
      sortOrder: z.number().optional(),
      active: z.boolean().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      res.status(201).json(await catalogService.createBanner(req.body));
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/banners/:id",
  requireStaff(["super_admin", "admin", "content"]),
  validateBody(bannerBody),
  async (req, res, next) => {
    try {
      res.json(await catalogService.updateBanner(req.params.id as string, req.body));
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/banners/:id",
  requireStaff(["super_admin", "admin", "content"]),
  async (req, res, next) => {
    try {
      await catalogService.deleteBanner(req.params.id as string);
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  },
);

router.get("/pages", async (_req, res, next) => {
  try {
    res.json(await catalogService.listCmsPages());
  } catch (e) {
    next(e);
  }
});

router.patch(
  "/pages/:slug",
  requireStaff(["super_admin", "admin", "content"]),
  validateBody(
    z.object({
      title: z.string().optional(),
      body: z.string().optional(),
      published: z.boolean().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      res.json(await catalogService.updateCmsPage(req.params.slug as string, req.body));
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/brands/:id",
  requireStaff(["super_admin", "admin", "catalog"]),
  validateBody(
    z.object({
      slug: z.string().optional(),
      name: z.string().optional(),
      featured: z.boolean().optional(),
      sortOrder: z.number().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      res.json(await catalogService.updateBrand(req.params.id as string, req.body));
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/brands/:id",
  requireStaff(["super_admin", "admin", "catalog"]),
  async (req, res, next) => {
    try {
      await catalogService.deleteBrand(req.params.id as string);
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/pages",
  requireStaff(["super_admin", "admin", "content"]),
  validateBody(
    z.object({
      slug: z.string().min(1),
      title: z.string().min(1),
      body: z.string().default(""),
      published: z.boolean().default(true),
    }),
  ),
  async (req, res, next) => {
    try {
      res.status(201).json(await catalogService.createCmsPage(req.body));
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/pages/:slug",
  requireStaff(["super_admin", "admin", "content"]),
  async (req, res, next) => {
    try {
      await catalogService.deleteCmsPage(req.params.slug as string);
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  },
);

router.get("/coupons", async (_req, res, next) => {
  try {
    res.json(await couponService.listCoupons());
  } catch (e) {
    next(e);
  }
});

router.post(
  "/coupons",
  requireStaff(["super_admin", "admin", "catalog"]),
  validateBody(
    z.object({
      code: z.string().min(1),
      type: z.enum(COUPON_TYPES),
      value: z.number().positive(),
      minSubtotal: z.number().nonnegative().optional(),
      maxDiscount: z.number().nonnegative().optional(),
      expiresAt: z.string().datetime().optional(),
      usageLimit: z.number().int().nonnegative().optional(),
      active: z.boolean().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      res.status(201).json(await couponService.createCoupon(req.body));
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/coupons/:id",
  requireStaff(["super_admin", "admin", "catalog"]),
  validateBody(
    z.object({
      code: z.string().min(1).optional(),
      type: z.enum(COUPON_TYPES).optional(),
      value: z.number().positive().optional(),
      minSubtotal: z.number().nonnegative().optional(),
      maxDiscount: z.number().nonnegative().nullable().optional(),
      expiresAt: z.string().datetime().nullable().optional(),
      usageLimit: z.number().int().nonnegative().nullable().optional(),
      active: z.boolean().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      res.json(await couponService.updateCoupon(req.params.id as string, req.body));
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/coupons/:id",
  requireStaff(["super_admin", "admin", "catalog"]),
  async (req, res, next) => {
    try {
      await couponService.deleteCoupon(req.params.id as string);
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  },
);

router.get("/messages", async (_req, res, next) => {
  try {
    res.json(await contactService.listContactMessages());
  } catch (e) {
    next(e);
  }
});

router.patch(
  "/messages/:id",
  validateBody(z.object({ read: z.boolean() })),
  async (req, res, next) => {
    try {
      res.json(await contactService.markContactMessageRead(req.params.id as string, req.body.read));
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/messages/:id",
  async (req, res, next) => {
    try {
      await contactService.deleteContactMessage(req.params.id as string);
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  },
);

export default router;
