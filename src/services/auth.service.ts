import bcrypt from "bcryptjs";
import { Customer, StaffUser } from "../models/index.js";
import { AppError } from "../lib/errors.js";
import { signToken } from "../lib/jwt.js";

export async function loginStaff(email: string, password: string) {
  const user = await StaffUser.findOne({ email: email.toLowerCase() });
  if (!user || !user.active) {
    throw new AppError(401, "Invalid email or password");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, "Invalid email or password");
  }

  const token = signToken({
    sub: String(user._id),
    email: user.email,
    role: user.role as import("../models/index.js").StaffRole,
    type: "staff",
  });

  return {
    token,
    user: {
      id: String(user._id),
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    },
  };
}

export async function getStaffProfile(id: string) {
  const user = await StaffUser.findById(id).select("email fullName role active");
  if (!user) throw new AppError(404, "User not found");
  return {
    id: String(user._id),
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    active: user.active,
  };
}

function signCustomerToken(customer: { _id: unknown; email: string }) {
  return signToken({
    sub: String(customer._id),
    email: customer.email,
    role: "customer",
    type: "customer",
  });
}

export async function registerCustomer(input: {
  email: string;
  password: string;
  fullName?: string;
  company?: string;
  phone?: string;
}) {
  const email = input.email.toLowerCase();
  const existing = await Customer.findOne({ email });
  if (existing) throw new AppError(409, "An account with this email already exists");

  const passwordHash = await bcrypt.hash(input.password, 10);
  const customer = await Customer.create({
    email,
    passwordHash,
    fullName: input.fullName ?? "",
    company: input.company,
    phone: input.phone,
  });

  return { token: signCustomerToken(customer), user: mapCustomerProfile(customer) };
}

export async function loginCustomer(email: string, password: string) {
  const customer = await Customer.findOne({ email: email.toLowerCase() });
  if (!customer?.passwordHash) {
    throw new AppError(401, "Invalid email or password");
  }

  const valid = await bcrypt.compare(password, customer.passwordHash);
  if (!valid) {
    throw new AppError(401, "Invalid email or password");
  }

  return { token: signCustomerToken(customer), user: mapCustomerProfile(customer) };
}

export async function getCustomerProfile(id: string) {
  const customer = await Customer.findById(id);
  if (!customer) throw new AppError(404, "User not found");
  return mapCustomerProfile(customer);
}

function mapCustomerProfile(customer: {
  _id: unknown;
  email: string;
  fullName: string;
  company?: string | null;
  phone?: string | null;
  taxExempt: string;
  netTermsEnabled: boolean;
}) {
  return {
    id: String(customer._id),
    email: customer.email,
    fullName: customer.fullName,
    company: customer.company ?? undefined,
    phone: customer.phone ?? undefined,
    taxExempt: customer.taxExempt,
    netTermsEnabled: customer.netTermsEnabled,
  };
}
