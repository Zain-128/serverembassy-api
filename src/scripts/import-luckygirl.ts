import fs from "fs";
import path from "path";
import "dotenv/config";
import { connectDb, disconnectDb } from "../lib/db.js";
import { Brand, Category, Product } from "../models/index.js";

async function main() {
  await connectDb();

  const dataPath = path.resolve(
    process.cwd(),
    "../scripts/luckygirl_data.json"
  );
  if (!fs.existsSync(dataPath)) {
    throw new Error(`Data file not found at: ${dataPath}`);
  }

  const raw = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const items = raw.products || raw;

  console.log(`📦 Found ${items.length} products to import from ${dataPath}...`);

  // 1. Create Brand: Lucky Girl Scoops
  const brand = await Brand.findOneAndUpdate(
    { slug: "lucky-girl-scoops" },
    {
      slug: "lucky-girl-scoops",
      name: "Lucky Girl Scoops",
      featured: true,
      sortOrder: 1,
    },
    { upsert: true, new: true }
  );

  // 2. Create Categories
  const categoryDefs = [
    {
      slug: "lucky-scoops",
      name: "Lucky Scoops & Mystery Boxes",
      description: "Our signature viral lucky scoops packed with beauty surprises, candy, and exclusive treats!",
      showOnHomepage: true,
      sortOrder: 1,
    },
    {
      slug: "lip-care",
      name: "Lip Care & Cosmetics",
      description: "Hydrating lip oils, juicy glosses, and plumping balms for the ultimate shine.",
      showOnHomepage: true,
      sortOrder: 2,
    },
    {
      slug: "merch-apparel",
      name: "Lucky Girl Merch & Apparel",
      description: "Cozy oversized hoodies, graphic tees, tote bags, and satin accessories.",
      showOnHomepage: true,
      sortOrder: 3,
    },
    {
      slug: "digital-business",
      name: "Business Guides & Vendor Lists",
      description: "Scale your beauty brand with our proven mentorship calls, blueprint courses, and verified vendor contacts.",
      showOnHomepage: true,
      sortOrder: 4,
    },
    {
      slug: "beauty-accessories",
      name: "Beauty Tools & Accessories",
      description: "Keychains, face tools, hair bonnets, and cosmetic essentials.",
      showOnHomepage: true,
      sortOrder: 5,
    },
  ];

  const catMap = new Map<string, any>();
  for (const c of categoryDefs) {
    const doc = await Category.findOneAndUpdate(
      { slug: c.slug },
      c,
      { upsert: true, new: true }
    );
    catMap.set(c.slug, doc);
  }

  // Helper to categorize
  function getCategorySlug(title: string): string {
    const t = title.toLowerCase();
    if (t.includes("scoop") || t.includes("mystery") || t.includes("raffle") || t.includes("ticket")) {
      return "lucky-scoops";
    }
    if (t.includes("lip") || t.includes("gloss") || t.includes("balm") || t.includes("glaze") || t.includes("oil")) {
      return "lip-care";
    }
    if (t.includes("tote") || t.includes("hoodie") || t.includes("crewneck") || t.includes("tee") || t.includes("sleeve") || t.includes("bonnet")) {
      return "merch-apparel";
    }
    if (t.includes("mentor") || t.includes("vendor") || t.includes("blueprint") || t.includes("coaching") || t.includes("template") || t.includes("card")) {
      return "digital-business";
    }
    return "beauty-accessories";
  }

  let imported = 0;
  for (const item of items) {
    const catSlug = getCategorySlug(item.title);
    const category = catMap.get(catSlug) || catMap.get("lucky-scoops");

    const images = (item.images || []).map((url: string, idx: number) => ({
      url,
      altText: item.title,
      sortOrder: idx,
      isPrimary: idx === 0,
    }));

    const options = (item.options || []).map((o: any) => ({
      name: o.name,
      position: o.position ?? 1,
      values: Array.isArray(o.values) ? o.values : [],
    }));

    const price = Number(item.price) || 0;
    const compareAtPrice = item.compareAtPrice ? Number(item.compareAtPrice) : undefined;
    const isDeal = Boolean(compareAtPrice && compareAtPrice > price);

    const isFeatured =
      item.title.toLowerCase().includes("scoop") ||
      item.title.toLowerCase().includes("halloween") ||
      item.title.toLowerCase().includes("mystery");

    const productDoc = {
      sku: `LGS-${item.id}`,
      slug: item.handle || `product-${item.id}`,
      title: item.title,
      brandId: brand._id,
      categoryId: category._id,
      description: item.description || `Experience the viral ${item.title} from Lucky Girl Scoops. High quality, super fun, and packed with love!`,
      price,
      compareAtPrice,
      stock: item.available === false ? 15 : 45, // Set in-stock inventory for demo
      status: "published",
      featured: isFeatured,
      isDeal,
      images,
      options,
      rating: 5.0,
      reviewCount: Math.floor(Math.random() * 25) + 5,
    };

    await Product.findOneAndUpdate(
      { slug: productDoc.slug },
      productDoc,
      { upsert: true }
    );
    imported++;
  }

  console.log(`\n🎉 SUCCESS: Successfully imported ${imported} Lucky Girl Scoops products into MongoDB!`);
  await disconnectDb();
}

main().catch(async (err) => {
  console.error("❌ Import error:", err);
  await disconnectDb();
  process.exit(1);
});
