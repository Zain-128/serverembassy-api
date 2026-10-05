import "dotenv/config";
import mongoose from "mongoose";
import { Order, Customer, Quote, NewsletterSubscriber } from "../src/models/index.js";

const EMAIL_PATTERN = /^qa\.(e2e|cod|stripe|checkout)\./i;

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);

  const orders = await Order.find({ email: EMAIL_PATTERN }).select("orderNumber email status");
  const customers = await Customer.find({ email: EMAIL_PATTERN }).select("email fullName");
  const quotes = await Quote.find({ email: EMAIL_PATTERN }).select("email name");
  const subs = await NewsletterSubscriber.find({ email: EMAIL_PATTERN }).select("email");

  console.log("Orders:", orders.map((o) => ({ id: String(o._id), orderNumber: o.orderNumber, email: o.email })));
  console.log("Customers:", customers.map((c) => ({ id: String(c._id), email: c.email })));
  console.log("Quotes:", quotes.map((q) => ({ id: String(q._id), email: q.email })));
  console.log("NewsletterSubscribers:", subs.map((s) => ({ id: String(s._id), email: s.email })));

  await mongoose.disconnect();
}

main();
