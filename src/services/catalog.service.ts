import { Types } from "mongoose";
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

export async function listCategories(publicOnly = false) {
  const filter = publicOnly ? { showOnHomepage: true } : {};
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

export async function getCategoryTree() {
  const categories = await Category.find().sort({ sortOrder: 1, name: 1 }).lean();
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

export async function createCategory(data: Record<string, unknown>) {
  const doc = await Category.create(data);
  return mapDoc(doc);
}

export async function updateCategory(id: string, data: Record<string, unknown>) {
  if (!Types.ObjectId.isValid(id)) throw new AppError(404, "Category not found");
  const doc = await Category.findByIdAndUpdate(id, data, { new: true });
  if (!doc) throw new AppError(404, "Category not found");
  return mapDoc(doc);
}

export async function deleteCategory(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new AppError(404, "Category not found");
  const { Product } = await import("../models/index.js");
  const count = await Product.countDocuments({ categoryId: id });
  if (count > 0) throw new AppError(400, "Category has products. Move or delete them first.");
  const result = await Category.findByIdAndDelete(id);
  if (!result) throw new AppError(404, "Category not found");
}

export async function listBrands(featuredOnly = false) {
  const filter = featuredOnly ? { featured: true } : {};
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
  if (!Types.ObjectId.isValid(id)) throw new AppError(404, "Brand not found");
  const doc = await Brand.findByIdAndUpdate(id, data, { new: true });
  if (!doc) throw new AppError(404, "Brand not found");
  return mapDoc(doc);
}

export async function deleteBrand(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new AppError(404, "Brand not found");
  const { Product } = await import("../models/index.js");
  const count = await Product.countDocuments({ brandId: id });
  if (count > 0) throw new AppError(400, "Brand has products. Reassign or delete them first.");
  const result = await Brand.findByIdAndDelete(id);
  if (!result) throw new AppError(404, "Brand not found");
}

export async function getStoreSettings() {
  let doc = await StoreSettings.findOne({ key: "default" });
  if (!doc) {
    doc = await StoreSettings.create({ key: "default" });
  }
  return mapDoc(doc);
}

export async function updateStoreSettings(data: Record<string, unknown>) {
  const doc = await StoreSettings.findOneAndUpdate(
    { key: "default" },
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
  if (!Types.ObjectId.isValid(id)) throw new AppError(404, "Banner not found");
  const doc = await Banner.findByIdAndUpdate(id, data, { new: true });
  if (!doc) throw new AppError(404, "Banner not found");
  return mapDoc(doc);
}

export async function deleteBanner(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new AppError(404, "Banner not found");
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
