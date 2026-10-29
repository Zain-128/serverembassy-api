import bcrypt from "bcryptjs";
import "dotenv/config";
import { connectDb, disconnectDb } from "./lib/db.js";
import {
  Banner,
  Brand,
  Category,
  CmsPage,
  Coupon,
  Product,
  StaffUser,
  StoreSettings,
} from "./models/index.js";

async function main() {
  await connectDb();

  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@serverembassy.com";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin123";

  await StoreSettings.findOneAndUpdate(
    { key: "default" },
    { key: "default" },
    { upsert: true },
  );

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await StaffUser.findOneAndUpdate(
    { email: adminEmail },
    {
      email: adminEmail,
      passwordHash,
      fullName: "Admin",
      role: "super_admin",
      active: true,
    },
    { upsert: true },
  );

  const brandData = [
    { slug: "cisco", name: "Cisco", featured: true, sortOrder: 1 },
    { slug: "dell", name: "Dell", featured: true, sortOrder: 2 },
    { slug: "hpe", name: "HPE", featured: true, sortOrder: 3 },
    { slug: "ibm", name: "IBM", featured: true, sortOrder: 4 },
    { slug: "juniper", name: "Juniper", featured: true, sortOrder: 5 },
    { slug: "supermicro", name: "Supermicro", featured: true, sortOrder: 6 },
  ];

  for (const b of brandData) {
    await Brand.findOneAndUpdate({ slug: b.slug }, b, { upsert: true });
  }

  const storage = await Category.findOneAndUpdate(
    { slug: "storage-devices" },
    { slug: "storage-devices", name: "Storage Devices", sortOrder: 1 },
    { upsert: true, new: true },
  );

  const hdd = await Category.findOneAndUpdate(
    { slug: "hard-drives" },
    {
      slug: "hard-drives",
      name: "Hard Drives",
      parentId: storage._id,
      showOnHomepage: true,
      bannerTitle: "Enterprise Hard Drives",
      sortOrder: 2,
    },
    { upsert: true, new: true },
  );

  const serverHdd = await Category.findOneAndUpdate(
    { slug: "server-hard-drive" },
    { slug: "server-hard-drive", name: "Server Hard Drive", parentId: hdd._id, sortOrder: 3 },
    { upsert: true, new: true },
  );

  const switches = await Category.findOneAndUpdate(
    { slug: "network-switches" },
    {
      slug: "network-switches",
      name: "Network Switches",
      showOnHomepage: true,
      bannerTitle: "Network Switches",
      sortOrder: 6,
    },
    { upsert: true, new: true },
  );

  const dell = await Brand.findOne({ slug: "dell" });
  const cisco = await Brand.findOne({ slug: "cisco" });
  const hpe = await Brand.findOne({ slug: "hpe" });
  const ibm = await Brand.findOne({ slug: "ibm" });

  if (dell && cisco) {
    await Product.findOneAndUpdate(
      { sku: "SG350-10" },
      {
        sku: "SG350-10",
        slug: "cisco-sg350-10-gigabit-managed-switch",
        title: "Cisco SG350-10 10-Port Gigabit Managed Switch",
        brandId: cisco._id,
        categoryId: switches._id,
        price: 189,
        compareAtPrice: 249,
        stock: 14,
        featured: true,
        isDeal: true,
        status: "published",
        description: "Compact managed gigabit switch for branch offices.",
        features: ["10 × Gigabit ports", "Layer 2/3 managed"],
        gtin: "00166298974216",
        mpn: "SG350-10-K9-NA",
        link: "https://example.com/products/cisco-sg350-10",
        googleProductCategory: "Electronics > Computers & Accessories > Networking",
        customLabel0: "Enterprise",
        shipping: "0 USD",
        tax: "US:0.07",
      },
      { upsert: true },
    );

    await Product.findOneAndUpdate(
      { sku: "005YPM" },
      {
        sku: "005YPM",
        slug: "005ypm-dell-server-hard-drive",
        title: "005YPM Dell Server Hard Drive",
        brandId: dell._id,
        categoryId: serverHdd._id,
        price: 500.51,
        compareAtPrice: 600.61,
        stock: 8,
        condition: "certified_refurbished",
        featured: true,
        status: "published",
        description: "Dell enterprise server hard drive.",
        gtin: "00888357000523",
        mpn: "005YPM",
        link: "https://example.com/products/dell-005ypm",
        googleProductCategory: "Electronics > Computers & Accessories > Computer Components > Storage",
        customLabel0: "Enterprise",
        shipping: "0 USD",
        tax: "US:0.07",
      },
      { upsert: true },
    );

    await Product.findOneAndUpdate(
      { sku: "C9300-24T" },
      {
        sku: "C9300-24T",
        slug: "cisco-catalyst-9300-24t",
        title: "Cisco Catalyst 9300 24-Port Switch",
        brandId: cisco._id,
        categoryId: switches._id,
        price: 1890,
        stock: 5,
        featured: true,
        status: "published",
        description: "Stackable access switch for campus cores.",
        gtin: "00886297267813",
        mpn: "C9300-24T-E",
        link: "https://example.com/products/cisco-catalyst-9300-24t",
        googleProductCategory: "Electronics > Computers & Accessories > Networking",
        customLabel0: "Network",
        shipping: "0 USD",
        tax: "US:0.07",
      },
      { upsert: true },
    );
  }

  if (hpe) {
    await Product.findOneAndUpdate(
      { sku: "P18432-B21" },
      {
        sku: "P18432-B21",
        slug: "hpe-1-2tb-sas-hdd",
        title: "HPE 1.2TB 10K SAS 12G Server HDD",
        brandId: hpe._id,
        categoryId: serverHdd._id,
        price: 219,
        stock: 22,
        featured: false,
        status: "published",
        description: "Hot-plug SAS drive for ProLiant servers.",
      },
      { upsert: true },
    );
  }

  if (ibm) {
    await Product.findOneAndUpdate(
      { sku: "00AJ140" },
      {
        sku: "00AJ140",
        slug: "ibm-600gb-sas-hdd",
        title: "IBM 600GB 10K SAS 6G Hard Drive",
        brandId: ibm._id,
        categoryId: serverHdd._id,
        price: 164,
        stock: 11,
        featured: false,
        status: "published",
        description: "IBM System x compatible SAS HDD.",
      },
      { upsert: true },
    );
  }

  for (const banner of [
    {
      title: "Cisco Devices on Sale",
      subtitle: "Great prices on routers, switches, firewalls & more.",
      ctaLabel: "Shop Now",
      href: "/shop/network-switches",
      size: "hero",
      sortOrder: 1,
      active: true,
    },
    {
      title: "Power Supply Units",
      subtitle: "Hot-swap PSUs for Dell, HP, and IBM servers.",
      ctaLabel: "View Details",
      href: "/shop/power-supplies",
      size: "half",
      sortOrder: 2,
      active: true,
    },
    {
      title: "Enterprise Hard Drives",
      subtitle: "SAS & SATA drives in stock and ready to ship.",
      ctaLabel: "View Details",
      href: "/shop/hard-drives",
      size: "half",
      sortOrder: 3,
      active: true,
    },
  ]) {
    await Banner.findOneAndUpdate({ title: banner.title }, banner, { upsert: true });
  }

  for (const page of [
    {
      slug: "shipping",
      title: "Shipping Policy",
      body: `## Order Fulfillment & Processing
In-stock orders are processed and prepared for dispatch within 1–2 business days (Monday through Friday, excluding federal holidays).

## Shipping Methods & Domestic Delivery
Orders are shipped via major national carriers (including FedEx and UPS) or certified freight carriers for heavy rack-mount equipment.
- Standard Ground Shipping: Typically delivers within 3–5 business days across the continental United States.
- Free Shipping: Orders qualifying over $199 unlock complimentary standard ground shipping. For orders under $199, standard shipping is calculated at checkout.
- Freight Deliveries: Palletized or multi-node server orders require freight handling. Our logistics team will coordinate dispatch details upon order confirmation.

## Tracking & Order Status
A carrier tracking number is generated and sent to your order email address as soon as your shipment is dispatched.

## Custom Shipping Inquiries
If you have special shipping instructions, dock delivery requirements, or international shipping inquiries, please contact our support desk directly at (321) 788-5899 or email info@powerlinedevices.com before placing your order.`,
    },
    {
      slug: "returns",
      title: "Return Policy",
      body: `## 30-Day Return Window & RMA Authorization
We offer a 30-day return window from the date of confirmed delivery. Before returning any equipment, you must contact our support desk to receive a Return Merchandise Authorization (RMA) number. Returns received without an RMA number cannot be accepted.

## Condition & Eligibility
- Items must be returned in their original condition with all serial numbers, manufacturer tags, and warranty seals intact.
- All original power cables, brackets, transceivers, and packaging materials must be included with the return.
- If you receive a defective or incorrect item, contact our team immediately and we will provide a replacement or full refund.

## Warranty Coverage
Certified refurbished and used hardware items include a 30-day hardware replacement warranty. If a component experiences a hardware failure under normal operating conditions within 30 days of delivery, our support team will replace the unit or issue a refund.

## Refund Process
Once returned items are received and inspected, approved refunds will be processed back to your original payment method within 3–5 business days.

## Requesting a Return
To initiate a return or warranty inquiry, please contact customer support at (321) 788-5899 or email info@powerlinedevices.com with your order number and item details.`,
    },
  ]) {
    await CmsPage.findOneAndUpdate({ slug: page.slug }, page, { upsert: true });
  }

  const coupons = [
    { code: "SAVE10", type: "percent", value: 10, active: true },
    { code: "WELCOME25", type: "fixed", value: 25, minSubtotal: 150, active: true },
  ];
  for (const coupon of coupons) {
    await Coupon.findOneAndUpdate({ code: coupon.code }, coupon, { upsert: true });
  }

  console.log("Seed complete.");
  console.log(`Admin: ${adminEmail} / ${adminPassword}`);
  await disconnectDb();
}

main().catch(async (e) => {
  console.error(e);
  await disconnectDb();
  process.exit(1);
});
