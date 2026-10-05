import "dotenv/config";
import mongoose from "mongoose";
import { Order, Customer, Quote, NewsletterSubscriber } from "../src/models/index.js";

const ORDER_IDS = ["6ac3631f7ada2776f4032673", "6ac363207ada2776f403267b"];
const CUSTOMER_IDS = ["6ac362d4d984a01c5c0f8da2"];
const QUOTE_IDS = ["6ac362d5d984a01c5c0f8da8"];
const SUBSCRIBER_IDS = ["6ac362d52828cdf1abbb8276"];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);

  const orderRes = await Order.deleteMany({ _id: { $in: ORDER_IDS } });
  const customerRes = await Customer.deleteMany({ _id: { $in: CUSTOMER_IDS } });
  const quoteRes = await Quote.deleteMany({ _id: { $in: QUOTE_IDS } });
  const subRes = await NewsletterSubscriber.deleteMany({ _id: { $in: SUBSCRIBER_IDS } });

  console.log("Deleted orders:", orderRes.deletedCount);
  console.log("Deleted customers:", customerRes.deletedCount);
  console.log("Deleted quotes:", quoteRes.deletedCount);
  console.log("Deleted newsletter subscribers:", subRes.deletedCount);

  await mongoose.disconnect();
}

main();
