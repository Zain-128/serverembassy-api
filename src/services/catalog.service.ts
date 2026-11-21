import { Types, isValidObjectId } from "mongoose";
import {
  Banner,
  Brand,
  Category,
  CmsPage,
  StoreSettings,
} from "../models/index.js";
import { AppError, mapDoc } from "../lib/errors.js";
import {
  paginate,
  totalPagesOf,
  type PaginationQuery,
} from "../lib/paginate.js";

export async function listCategories(publicOnly = false, storeOrigin?: string) {
  const filter: Record<string, unknown> = publicOnly ? { showOnHomepage: true } : {};
  if (storeOrigin === "luckygirl") {
    filter.slug = { $regex: /lucky/i };
  } else {
    filter.slug = { $not: { $regex: /lucky/i } };
  }
  const docs = await Category.find(filter).sort({ sortOrder: 1, name: 1 });
  return docs.map((d) => mapDoc(d));
}

export async function listCategoriesPaginated(query: PaginationQuery) {
  const { page, limit, skip } = paginate(query);
  const [docs, total] = await Promise.all([
    Category.find()
      .sort({ sortOrder: 1, name: 1 })
      .skip(skip)
      .limit(limit),
    Category.countDocuments(),
  ]);
  return {
    items: docs.map((d) => mapDoc(d)),
    total,
    page,
    limit,
    totalPages: totalPagesOf(total, limit),
  };
}

export async function getCategoryTree(storeOrigin?: string) {
  let query: Record<string, unknown> = {};
  if (storeOrigin === "luckygirl") {
    query = { slug: { $regex: /lucky/i } };
  } else {
    query = { slug: { $not: { $regex: /lucky/i } } };
  }
  const categories = await Category.find(query).sort({ sortOrder: 1, name: 1 }).lean();
  type Node = (typeof categories)[number] & { children: Node[]; id: string };
  const map = new Map<string, Node>();

  for (const c of categories) {
    map.set(String(c._id), { ...c, id: String(c._id), children: [] });
  }

  const roots: Node[] = [];
  for (const cat of map.values()) {
    const parentId = cat.parentId ? String(cat.parentId) : null;
    if (parentId && map.has(parentId)) {
      map.get(parentId)!.children.push(cat);
    } else if (!parentId) {
      roots.push(cat);
    }
  }
  return roots;
}

export async function getCategoryBySlug(slug: string) {
  const doc = await Category.findOne({ slug });
  if (!doc) throw new AppError(404, "Category not found");
  return mapDoc(doc);
}

/** Every category (unpaginated) — the admin needs the full set to render the tree. */
export async function listAllCategories() {
  const docs = await Category.find().sort({ sortOrder: 1, name: 1 });
  return docs.map((d) => mapDoc(d));
}

function normalizeParentId(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}

/**
 * Ensures `parentId` exists and — when re-parenting an existing category —
 * isn't the category itself or one of its descendants (which would create a cycle).
 */
async function assertValidParent(parentId: string | null, selfId?: string) {
  if (!parentId) return;
  if (!isValidObjectId(parentId)) throw new AppError(400, "Parent category not found");
  if (selfId && parentId === selfId) throw new AppError(400, "A category cannot be its own parent");

  let cursor: string | null = parentId;
  const seen = new Set<string>();
  while (cursor) {
    if (seen.has(cursor)) break; // pre-existing bad data; stop walking
    seen.add(cursor);
    const node: { parentId?: unknown } | null = await Category.findById(cursor).select("parentId").lean();
    if (!node) {
      if (cursor === parentId) throw new AppError(400, "Parent category not found");
      break;
    }
    if (selfId && cursor === selfId) {
      throw new AppError(400, "Cannot move a category inside one of its own subcategories");
    }
    cursor = normalizeParentId(node.parentId);
  }
}

/** Same-named subcategories under different parents need distinct slugs. */
async function uniqueCategorySlug(base: string, parentId: string | null, excludeId?: string) {
  const taken = async (slug: string) =>
    !!(await Category.exists(excludeId ? { slug, _id: { $ne: excludeId } } : { slug }));
  if (!(await taken(base))) return base;
  if (parentId) {
    const parent: { slug?: string } | null = await Category.findById(parentId).select("slug").lean();
    if (parent?.slug) {
      const prefixed = `${parent.slug}-${base}`;
      if (!(await taken(prefixed))) return prefixed;
      base = prefixed;
    }
  }
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!(await taken(candidate))) return candidate;
  }
  throw new AppError(409, "Could not generate a unique category slug");
}

export async function createCategory(data: Record<string, unknown>) {
  const parentId = normalizeParentId(data.parentId);
  await assertValidParent(parentId);
  const slug = await uniqueCategorySlug(String(data.slug), parentId);
  const doc = await Category.create({ ...data, parentId, slug });
  return mapDoc(doc);
}

export async function updateCategory(id: string, data: Record<string, unknown>) {
  if (!isValidObjectId(id)) throw new AppError(404, "Category not found");
  const update = { ...data };
  if ("parentId" in update) {
    update.parentId = normalizeParentId(update.parentId);
    await assertValidParent(update.parentId as string | null, id);
  }
  if (typeof update.slug === "string") {
    const parentId =
      "parentId" in update
        ? (update.parentId as string | null)
        : normalizeParentId((await Category.findById(id).select("parentId").lean())?.parentId);
    update.slug = await uniqueCategorySlug(update.slug, parentId, id);
  }
  const doc = await Category.findByIdAndUpdate(id, update, { new: true });
  if (!doc) throw new AppError(404, "Category not found");
  return mapDoc(doc);
}

export async function deleteCategory(id: string) {
  if (!isValidObjectId(id)) throw new AppError(404, "Category not found");
  const { Product } = await import("../models/index.js");
  const count = await Product.countDocuments({ categoryId: id });
  if (count > 0) throw new AppError(400, "Category has products. Move or delete them first.");
  const children = await Category.countDocuments({ parentId: id });
  if (children > 0) {
    throw new AppError(400, "Category has subcategories. Move or delete them first.");
  }
  const result = await Category.findByIdAndDelete(id);
  if (!result) throw new AppError(404, "Category not found");
}

export async function listBrands(featuredOnly = false, storeOrigin?: string) {
  const filter: Record<string, unknown> = featuredOnly ? { featured: true } : {};
  if (storeOrigin === "luckygirl") {
    filter.slug = { $regex: /lucky/i };
  } else {
    filter.slug = { $not: { $regex: /lucky/i } };
  }
  const docs = await Brand.find(filter).sort({ sortOrder: 1, name: 1 });
  return docs.map((d) => mapDoc(d));
}

export async function listBrandsPaginated(query: PaginationQuery) {
  const { page, limit, skip } = paginate(query);
  const [docs, total] = await Promise.all([
    Brand.find()
      .sort({ sortOrder: 1, name: 1 })
      .skip(skip)
      .limit(limit),
    Brand.countDocuments(),
  ]);
  return {
    items: docs.map((d) => mapDoc(d)),
    total,
    page,
    limit,
    totalPages: totalPagesOf(total, limit),
  };
}

export async function createBrand(data: Record<string, unknown>) {
  const doc = await Brand.create(data);
  return mapDoc(doc);
}

export async function updateBrand(id: string, data: Record<string, unknown>) {
  if (!isValidObjectId(id)) throw new AppError(404, "Brand not found");
  const doc = await Brand.findByIdAndUpdate(id, data, { new: true });
  if (!doc) throw new AppError(404, "Brand not found");
  return mapDoc(doc);
}

export async function deleteBrand(id: string) {
  if (!isValidObjectId(id)) throw new AppError(404, "Brand not found");
  const { Product } = await import("../models/index.js");
  const count = await Product.countDocuments({ brandId: id });
  if (count > 0) throw new AppError(400, "Brand has products. Reassign or delete them first.");
  const result = await Brand.findByIdAndDelete(id);
  if (!result) throw new AppError(404, "Brand not found");
}

export async function getStoreSettings(origin?: string) {
  const isServerEmbassy =
    origin?.toLowerCase().includes("serverembassy") ||
    origin?.toLowerCase().includes("server-embassy");

  if (isServerEmbassy) {
    let seDoc = await StoreSettings.findOne({ key: "serverembassy" });
    if (!seDoc) {
      seDoc = await StoreSettings.create({
        key: "serverembassy",
        storeName: "Server Embassy",
        tagline: "Trusted Enterprise IT Hardware & Global Solutions",
        phone: "+1 (727) 214-2001",
        supportEmail: "support@serverembassy.com",
        address: "7901 4th St. N Ste 300, St. Petersburg, FL 33702",
        hours: "Mon – Fri: 08:00 AM – 05:00 PM (GMT-4)",
        freeShippingThreshold: 199,
        freeShippingLabel: "Free ground shipping on orders over $199",
        taxRate: 0.07,
        currency: "USD",
      });
    }
    return mapDoc(seDoc);
  }

  let doc = await StoreSettings.findOne({ key: "default" });
  if (!doc) {
    doc = await StoreSettings.create({
      key: "default",
      storeName: "Power Line Devices",
      phone: "(321) 788-5899",
      supportEmail: "info@powerlinedevices.com",
      address: "1317 Edgewater Dr Suite #6089, Orlando, FL 32804",
      hours: "Mon – Fri: 09:00 AM – 06:00 PM EST",
    });
  }
  return mapDoc(doc);
}

export async function updateStoreSettings(data: Record<string, unknown>, origin?: string) {
  const key =
    origin?.toLowerCase().includes("serverembassy") ||
    origin?.toLowerCase().includes("server-embassy")
      ? "serverembassy"
      : "default";

  const doc = await StoreSettings.findOneAndUpdate(
    { key },
    { $set: data },
    { new: true, upsert: true },
  );
  return mapDoc(doc);
}

export async function listBanners(activeOnly = false) {
  const filter = activeOnly ? { active: true } : {};
  const docs = await Banner.find(filter).sort({ sortOrder: 1 });
  return docs.map((d) => mapDoc(d));
}

export async function listBannersPaginated(query: PaginationQuery) {
  const { page, limit, skip } = paginate(query);
  const [docs, total] = await Promise.all([
    Banner.find().sort({ sortOrder: 1 }).skip(skip).limit(limit),
    Banner.countDocuments(),
  ]);
  return {
    items: docs.map((d) => mapDoc(d)),
    total,
    page,
    limit,
    totalPages: totalPagesOf(total, limit),
  };
}

export async function createBanner(data: Record<string, unknown>) {
  const doc = await Banner.create(data);
  return mapDoc(doc);
}

export async function updateBanner(id: string, data: Record<string, unknown>) {
  if (!isValidObjectId(id)) throw new AppError(404, "Banner not found");
  const doc = await Banner.findByIdAndUpdate(id, data, { new: true });
  if (!doc) throw new AppError(404, "Banner not found");
  return mapDoc(doc);
}

export async function deleteBanner(id: string) {
  if (!isValidObjectId(id)) throw new AppError(404, "Banner not found");
  const result = await Banner.findByIdAndDelete(id);
  if (!result) throw new AppError(404, "Banner not found");
}

export async function listCmsPages(publicOnly = false) {
  const filter = publicOnly ? { published: true } : {};
  const docs = await CmsPage.find(filter).sort({ slug: 1 });
  return docs.map((d) => mapDoc(d));
}

export async function listCmsPagesPaginated(query: PaginationQuery) {
  const { page, limit, skip } = paginate(query);
  const [docs, total] = await Promise.all([
    CmsPage.find().sort({ slug: 1 }).skip(skip).limit(limit),
    CmsPage.countDocuments(),
  ]);
  return {
    items: docs.map((d) => mapDoc(d)),
    total,
    page,
    limit,
    totalPages: totalPagesOf(total, limit),
  };
}

export async function getCmsPageBySlug(slug: string) {
  const doc = await CmsPage.findOne({ slug, published: true });
  if (!doc) throw new AppError(404, "Page not found");
  return mapDoc(doc);
}

export async function createCmsPage(data: Record<string, unknown>) {
  const existing = await CmsPage.findOne({ slug: data.slug });
  if (existing) throw new AppError(409, "A page with this slug already exists");
  const doc = await CmsPage.create(data);
  return mapDoc(doc);
}

export async function deleteCmsPage(slug: string) {
  const result = await CmsPage.findOneAndDelete({ slug });
  if (!result) throw new AppError(404, "Page not found");
}

export async function updateCmsPage(slug: string, data: Record<string, unknown>) {
  const doc = await CmsPage.findOneAndUpdate({ slug }, data, { new: true });
  if (!doc) throw new AppError(404, "Page not found");
  return mapDoc(doc);
}
