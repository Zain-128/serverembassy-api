import fs from "fs";
import readline from "readline";
import "dotenv/config";
import { connectDb, disconnectDb } from "./lib/db.js";
import { Brand, Category, Product } from "./models/index.js";

function slugify(text: string): string {
  const slug = text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
  return slug || "item";
}

function parsePrice(val?: string): number {
  if (!val) return 0;
  const cleaned = val.replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseWeight(val?: string): number {
  if (!val) return 1;
  const num = parseFloat(val.replace(/[^0-9.]/g, ""));
  return isNaN(num) ? 1 : num;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function runImport() {
  const csvFilePath = "/Users/zainraza/Documents/GitHub/360_web_coders/Server Embassay 1st Uploaded File.csv";
  if (!fs.existsSync(csvFilePath)) {
    console.error(`CSV file not found at: ${csvFilePath}`);
    process.exit(1);
  }

  console.log("Connecting to MongoDB database...");
  await connectDb();

  console.log("Pre-loading Brand and Category maps...");
  const existingBrands = await Brand.find({});
  const brandMap = new Map<string, string>(); // brandNameLower -> _id string
  for (const b of existingBrands) {
    brandMap.set(b.name.toLowerCase(), (b._id as any).toString());
  }

  const existingCats = await Category.find({});
  const catMap = new Map<string, string>(); // catNameLower -> _id string
  for (const c of existingCats) {
    catMap.set(c.name.toLowerCase(), (c._id as any).toString());
  }

  async function getOrCreateBrandId(brandName: string): Promise<string> {
    const name = (brandName || "Generic").trim();
    const key = name.toLowerCase();
    if (brandMap.has(key)) {
      return brandMap.get(key)!;
    }
    const slug = slugify(name);
    const created = await Brand.findOneAndUpdate(
      { slug },
      { name, slug, featured: false, sortOrder: 99 },
      { upsert: true, new: true },
    );
    const idStr = (created._id as any).toString();
    brandMap.set(key, idStr);
    return idStr;
  }

  async function getOrCreateCategoryId(categoryName: string): Promise<string> {
    const name = (categoryName || "General").trim();
    const key = name.toLowerCase();
    if (catMap.has(key)) {
      return catMap.get(key)!;
    }
    const slug = slugify(name);
    const created = await Category.findOneAndUpdate(
      { slug },
      { name, slug, showOnHomepage: false, sortOrder: 99 },
      { upsert: true, new: true },
    );
    const idStr = (created._id as any).toString();
    catMap.set(key, idStr);
    return idStr;
  }

  console.log(`Reading CSV file: ${csvFilePath}...`);
  const fileStream = fs.createReadStream(csvFilePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let isHeader = true;
  let lineCount = 0;
  let importedCount = 0;
  const bulkOps: any[] = [];
  const seenSkus = new Set<string>();

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (isHeader) {
      isHeader = false;
      continue;
    }

    lineCount++;
    const cols = parseCsvLine(line);
    if (cols.length < 5) continue;

    const id = cols[0] || "";
    const title = cols[1] || "";
    const description = cols[2] || title;
    const link = cols[3] || "";
    const rawPrice = cols[4] || "";
    const rawSalePrice = cols[5] || "";
    const brandName = cols[6] || "Generic";
    const gtin = cols[7] || "";
    const rawCondition = (cols[8] || "New").toLowerCase();
    const imageLink = cols[9] || "";
    const mpn = cols[10] || "";
    const productType = cols[11] || "General";
    const rawQty = cols[12] || "9999";
    const shipping = cols[13] || "";
    const tax = cols[14] || "";
    const rawWeight = cols[15] || "1 lb";

    if (!title) continue;

    const sku = mpn || id || `SKU-${lineCount}`;
    if (seenSkus.has(sku)) continue;
    seenSkus.add(sku);

    const brandId = await getOrCreateBrandId(brandName);
    const categoryId = await getOrCreateCategoryId(productType);

    const price = parsePrice(rawPrice);
    const salePrice = parsePrice(rawSalePrice);
    const finalPrice = salePrice > 0 && salePrice < price ? salePrice : price || salePrice || 10;
    const compareAt = salePrice > 0 && salePrice < price ? price : undefined;
    const isDeal = Boolean(compareAt);

    let condition: "new" | "certified_refurbished" | "used" = "new";
    if (rawCondition.includes("refurbished") || rawCondition.includes("reconditioned")) {
      condition = "certified_refurbished";
    } else if (rawCondition.includes("used")) {
      condition = "used";
    }

    const stock = parseInt(rawQty, 10) || 9999;
    const weightLbs = parseWeight(rawWeight);
    const baseSlug = slugify(title);
    const slug = `${baseSlug}-${sku.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;

    const images = imageLink ? [{ url: imageLink, altText: title, isPrimary: true, sortOrder: 0 }] : [];

    const productDoc = {
      sku,
      slug,
      title,
      brandId,
      categoryId,
      description,
      condition,
      warranty: "30 Days Warranty",
      price: finalPrice,
      compareAtPrice: compareAt,
      stock,
      weightLbs,
      featured: lineCount <= 20,
      isDeal,
      status: "published" as const,
      images,
      link,
      gtin,
      mpn,
      shipping,
      tax,
    };

    bulkOps.push({
      updateOne: {
        filter: { sku },
        update: { $set: productDoc },
        upsert: true,
      },
    });

    if (bulkOps.length >= 1000) {
      await Product.bulkWrite(bulkOps, { ordered: false });
      importedCount += bulkOps.length;
      console.log(`Processed ${lineCount} CSV lines... Uploaded ${importedCount} products.`);
      bulkOps.length = 0;
    }
  }

  if (bulkOps.length > 0) {
    await Product.bulkWrite(bulkOps, { ordered: false });
    importedCount += bulkOps.length;
    bulkOps.length = 0;
  }

  console.log(`\n✅ CSV Product Upload Complete! Total products imported/upserted: ${importedCount}`);
  await disconnectDb();
}

runImport().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
