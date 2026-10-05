import mongoose from "mongoose";
import dotenv from "dotenv";
import { Banner } from "./models/index.js";

dotenv.config();

const bannersToSeed = [
  // HERO BANNERS
  {
    title: "Enterprise Rack & Blade Servers",
    subtitle: "NEXT-DAY DISPATCH ON POPULAR DELL & HPE CONFIGURATIONS",
    ctaLabel: "Explore Enterprise Servers",
    href: "/shop?category=servers",
    imageUrl: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&q=80",
    size: "hero",
    sortOrder: 1,
    active: true,
  },
  {
    title: "High-Performance Networking Equipment",
    subtitle: "AUTHENTIC CISCO, ARISTA & JUNIPER HARDWARE",
    ctaLabel: "Shop Network Switches",
    href: "/shop?category=networking",
    imageUrl: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=1200&q=80",
    size: "hero",
    sortOrder: 2,
    active: true,
  },
  {
    title: "SAN & NAS Storage Expansion Systems",
    subtitle: "ENTERPRISE-GRADE NVMe & SAS STORAGE ARRAYS",
    ctaLabel: "View Storage Systems",
    href: "/shop?category=storage",
    imageUrl: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=1200&q=80",
    size: "hero",
    sortOrder: 3,
    active: true,
  },
  // HALF & THIRD PROMO BANNERS
  {
    title: "Dell PowerEdge R740xd Special Offer",
    subtitle: "Save up to 30% on pre-configured 2U dual Xeon servers with full 1-year warranty.",
    ctaLabel: "Shop Dell Servers",
    href: "/shop",
    imageUrl: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80",
    size: "half",
    sortOrder: 1,
    active: true,
  },
  {
    title: "Cisco Catalyst 9300 Switches",
    subtitle: "48-Port PoE+ Switches in stock with redundant power supply units.",
    ctaLabel: "Shop Switches",
    href: "/shop",
    imageUrl: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&q=80",
    size: "half",
    sortOrder: 2,
    active: true,
  },
  {
    title: "Certified Enterprise Transceivers",
    subtitle: "10G, 40G & 100G optical modules tested and guaranteed compatible.",
    ctaLabel: "Browse Optics",
    href: "/shop",
    imageUrl: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=800&q=80",
    size: "third",
    sortOrder: 3,
    active: true,
  },
  {
    title: "Server Memory & CPU Upgrades",
    subtitle: "DDR4 ECC Registered RAM & Intel Xeon Scalable processors in stock.",
    ctaLabel: "Shop Components",
    href: "/shop",
    imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80",
    size: "third",
    sortOrder: 4,
    active: true,
  },
];

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set!");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(uri);
  console.log("Connected successfully!");

  console.log("Clearing existing banners...");
  await Banner.deleteMany({});

  console.log("Inserting promotional banners...");
  const created = await Banner.insertMany(bannersToSeed);
  console.log(`Successfully seeded ${created.length} banners into database!`);

  await mongoose.disconnect();
  console.log("Disconnected.");
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
