import { Types } from "mongoose";
import { Brand, Category, Product, type PublishStatus } from "../models/index.js";
import { AppError, mapDoc } from "../lib/errors.js";

const productPopulate = [
  { path: "brandId", select: "slug name" },
  { path: "categoryId", select: "slug name" },
];

type PopulatedProduct = {
  _id: Types.ObjectId;
  status: string;
  brandId: unknown;
  categoryId: unknown;
  populated: (path: string) => boolean;
};

function mapProduct(doc: PopulatedProduct | null) {
  if (!doc) return null;
  const base: Record<string, unknown> = mapDoc(
    doc as unknown as { _id: unknown; toObject?: () => Record<string, unknown> },
  );
  const brand = doc.populated("brandId")
    ? (doc.brandId as { _id: Types.ObjectId; slug: string; name: string })
    : null;
  const category = doc.populated("categoryId")
    ? (doc.categoryId as { _id: Types.ObjectId; slug: string; name: string })
    : null;

  return {
    ...(base as Record<string, unknown>),
    brandId: brand ? String(brand._id) : base.brandId,
    categoryId: category ? String(category._id) : base.categoryId,
    brand: brand ? { id: String(brand._id), slug: brand.slug, name: brand.name } : undefined,
    category: category
      ? { id: String(category._id), slug: category.slug, name: category.name }
      : undefined,
    published: base.status === "published",
  };
}

export type ProductListQuery = {
  page?: number;
  limit?: number;
  q?: string;
  categorySlug?: string;
  brandSlug?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  featured?: boolean;
  deal?: boolean;
  status?: PublishStatus;
  sort?: "price_asc" | "price_desc" | "newest" | "sku" | "rating";
};

async function getCategoryDescendantIds(categoryId: Types.ObjectId): Promise<Types.ObjectId[]> {
  const children = await Category.find({ parentId: categoryId }).select("_id");
  const nested = await Promise.all(
    children.map((c) => getCategoryDescendantIds(c._id as Types.ObjectId)),
  );
  return [...children.map((c) => c._id as Types.ObjectId), ...nested.flat()];
}

export async function listProducts(query: ProductListQuery, publicOnly = true) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 24));
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};

  if (publicOnly) {
    filter.status = "published";
  } else if (query.status) {
    filter.status = query.status;
  }

  if (query.q) {
    filter.$text = { $search: query.q };
  }

  if (query.categorySlug) {
    const cat = await Category.findOne({ slug: query.categorySlug });
    if (!cat) return { items: [], total: 0, page, limit, totalPages: 0 };
    const ids = await getCategoryDescendantIds(cat._id as Types.ObjectId);
    filter.categoryId = { $in: [cat._id, ...ids] };
  }

  if (query.brandSlug) {
    const brand = await Brand.findOne({ slug: query.brandSlug });
    if (brand) filter.brandId = brand._id;
  }

  if (query.minPrice != null || query.maxPrice != null) {
    filter.price = {};
    if (query.minPrice != null) (filter.price as Record<string, number>).$gte = query.minPrice;
    if (query.maxPrice != null) (filter.price as Record<string, number>).$lte = query.maxPrice;
  }

  if (query.inStock) filter.stock = { $gt: 0 };
  if (query.featured) filter.featured = true;
  if (query.deal) filter.isDeal = true;

  const sort: Record<string, 1 | -1> =
    query.sort === "price_asc"
      ? { price: 1 }
      : query.sort === "price_desc"
        ? { price: -1 }
        : query.sort === "sku"
          ? { sku: 1 }
          : query.sort === "rating"
            ? { rating: -1, reviewCount: -1 }
            : { createdAt: -1 };

  const [docs, total] = await Promise.all([
    Product.find(filter).populate(productPopulate).sort(sort).skip(skip).limit(limit),
    Product.countDocuments(filter),
  ]);

  return {
    items: docs.map((d) => mapProduct(d)!),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getProductBySlug(slug: string, publicOnly = true) {
  const filter: Record<string, unknown> = { slug };
  if (publicOnly) filter.status = "published";
  const doc = await Product.findOne(filter).populate(productPopulate);
  if (!doc) throw new AppError(404, "Product not found");
  return mapProduct(doc);
}

export async function getProductById(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new AppError(404, "Product not found");
  const doc = await Product.findById(id).populate(productPopulate);
  if (!doc) throw new AppError(404, "Product not found");
  return mapProduct(doc);
}

export async function getProductsByIds(ids: string[], publicOnly = true) {
  const validIds = ids.filter((id) => Types.ObjectId.isValid(id));
  if (!validIds.length) return [];
  const filter: Record<string, unknown> = { _id: { $in: validIds } };
  if (publicOnly) filter.status = "published";
  const docs = await Product.find(filter).populate(productPopulate);
  return docs.map((d) => mapProduct(d)!);
}

export async function createProduct(data: Record<string, unknown>) {
  const doc = await Product.create(data);
  const populated = await Product.findById(doc._id).populate(productPopulate);
  return mapProduct(populated)!;
}

export async function updateProduct(id: string, data: Record<string, unknown>) {
  if (!Types.ObjectId.isValid(id)) throw new AppError(404, "Product not found");
  const doc = await Product.findByIdAndUpdate(id, data, { new: true }).populate(productPopulate);
  if (!doc) throw new AppError(404, "Product not found");
  return mapProduct(doc);
}

export async function deleteProduct(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new AppError(404, "Product not found");
  const result = await Product.findByIdAndDelete(id);
  if (!result) throw new AppError(404, "Product not found");
}

export type ProductFeedRow = {
  id: string;
  title: string;
  description?: string;
  link?: string;
  price?: string | number;
  salePrice?: string | number;
  brand?: string;
  condition?: string;
  gtin?: string;
  imageLink?: string;
  mpn?: string;
  productType?: string;
  quantity?: string | number;
  shipping?: string;
  tax?: string;
  availability?: string;
  googleProductCategory?: string;
  shippingWeight?: string | number;
  customLabel0?: string;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toNumber(value: string | number | undefined): number | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value === "number") return value;
  const parsed = parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

const FEED_CONDITION_MAP: Record<string, string> = {
  new: "new",
  refurbished: "certified_refurbished",
  "certified refurbished": "certified_refurbished",
  certified_refurbished: "certified_refurbished",
  used: "used",
};

async function uniqueSlug(base: string, model: typeof Brand | typeof Category, gtin = false) {
  let candidate = base || (gtin ? `product-${Date.now()}` : "item");
  let i = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (!(await model.exists({ slug: candidate }))) return candidate;
    candidate = `${base}-${i}`;
    i += 1;
  }
}

async function ensureBrandByName(name: string, cache: Map<string, Types.ObjectId>) {
  const clean = (name || "").trim();
  if (!clean) return null;
  if (cache.has(clean)) return cache.get(clean);
  const existing = await Brand.findOne({ name: { $regex: new RegExp(`^${clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } });
  if (existing) {
    cache.set(clean, existing._id);
    return existing._id;
  }
  const brand = await Brand.create({ name: clean, slug: await uniqueSlug(slugify(clean), Brand) });
  cache.set(clean, brand._id);
  return brand._id;
}

async function ensureCategoryByPath(
  productType: string,
  cache: Map<string, Types.ObjectId>,
) {
  const segments = (productType || "")
    .split(">")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) return null;

  let parentId: Types.ObjectId | null = null;
  let walk = "";
  for (const segment of segments) {
    walk = walk ? `${walk} > ${segment}` : segment;
    if (cache.has(walk)) {
      parentId = cache.get(walk)!;
      continue;
    }

    const escapedName = segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const existing = (await Category.findOne({
      name: { $regex: new RegExp(`^${escapedName}$`, "i") },
      parentId: parentId ?? null,
    }).exec()) as { _id: Types.ObjectId } | null;
    if (existing) {
      cache.set(walk, existing._id);
      parentId = existing._id;
      continue;
    }

    const slug = await uniqueSlug(slugify(segment), Category);
    const category: { _id: Types.ObjectId } = await Category.create({
      name: segment,
      slug,
      parentId,
      showOnHomepage: !parentId,
      bannerTitle: segment,
    });
    cache.set(walk, category._id);
    parentId = category._id;
  }
  return parentId;
}

const IMPORT_ROW_LIMIT = 100;

export async function bulkUpsertProducts(rows: ProductFeedRow[]) {
  let created = 0;
  let updated = 0;
  const brandCache = new Map<string, Types.ObjectId>();
  const categoryCache = new Map<string, Types.ObjectId>();
  const errors: Array<{ sku: string; error: string }> = [];
  const limited = rows.slice(0, IMPORT_ROW_LIMIT);

  for (const row of limited) {
    try {
      const sku = (row.id || "").trim();
      if (!sku || !(row.title || "").trim()) {
        errors.push({ sku: sku || "(unknown)", error: "id and title are required" });
        continue;
      }

      const brandId = await ensureBrandByName(row.brand ?? "", brandCache);
      const categoryId = await ensureCategoryByPath(row.productType ?? "", categoryCache);
      if (!brandId || !categoryId) {
        errors.push({ sku, error: "brand and product_type are required" });
        continue;
      }

      const availability = (row.availability || "").toLowerCase().trim();
      const quantity = toNumber(row.quantity);
      const stock = quantity != null ? quantity : availability === "out of stock" ? 0 : 1;

      const price = toNumber(row.price);
      const salePrice = toNumber(row.salePrice);
      if (price == null || price < 0) {
        errors.push({ sku, error: "price must be a valid number" });
        continue;
      }
      const onSale = salePrice != null && salePrice >= 0 && salePrice < price;
      const sellingPrice = onSale ? salePrice! : price;
      const compareAtPrice = onSale ? price : null;

      const conditionKey = (row.condition || "").toLowerCase().trim();
      const condition = FEED_CONDITION_MAP[conditionKey] ?? "new";
      const imageLink = (row.imageLink || "").trim();
      const images = imageLink
        ? imageLink
            .split("|")
            .map((url) => url.trim())
            .filter(Boolean)
            .map((url, i) => ({
              url,
              altText: (row.title || "").trim(),
              sortOrder: i,
              isPrimary: i === 0,
            }))
        : [];

      const payload = {
        sku,
        title: (row.title || "").trim(),
        brandId,
        categoryId,
        description: (row.description || "").trim(),
        link: (row.link || "").trim(),
        gtin: (row.gtin || "").trim(),
        mpn: (row.mpn || "").trim() || sku,
        googleProductCategory: (row.googleProductCategory || "").trim(),
        customLabel0: (row.customLabel0 || "").trim(),
        shipping: (row.shipping || "").trim(),
        tax: (row.tax || "").trim(),
        condition,
        price: sellingPrice,
        compareAtPrice,
        stock: Math.max(0, Math.round(stock)),
        weightLbs: toNumber(row.shippingWeight) ?? 1,
        images,
        status: availability === "out of stock" ? ("draft" as const) : ("published" as const),
        isDeal: onSale,
        featured: false,
      };

      const existing = await Product.findOne({ sku });
      if (existing) {
        const { compareAtPrice: cmp, ...rest } = payload;
        if (cmp == null) {
          await Product.updateOne({ sku }, { $set: rest, $unset: { compareAtPrice: 1 } });
        } else {
          await Product.updateOne({ sku }, { $set: payload });
        }
        updated++;
      } else {
        const baseSlug = slugify(sku) || slugify(row.title || "") || `sku-${Date.now()}`;
        let slug = baseSlug;
        let n = 2;
        while (await Product.exists({ slug })) {
          slug = `${baseSlug}-${n}`;
          n += 1;
        }
        await Product.create({ slug, ...payload });
        created++;
      }
    } catch (e) {
      errors.push({
        sku: (row.id || "").trim() || "(unknown)",
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  return { created, updated, errors };
}
