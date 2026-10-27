import bcrypt from "bcryptjs";
import { Customer, StaffUser, Invite, Order } from "../models/index.js";
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

export async function deleteCustomer(id: string, password: string) {
  const customer = await Customer.findById(id);
  if (!customer) throw new AppError(404, "Account not found");

  if (!customer.passwordHash) throw new AppError(400, "Account has no password set");

  const valid = await bcrypt.compare(password, customer.passwordHash);
  if (!valid) throw new AppError(401, "Incorrect password");

  const deletedEmail = `deleted_${String(customer._id)}@deleted.com`;

  await Order.updateMany(
    { customerId: customer._id },
    {
      $set: {
        customerId: null,
        email: deletedEmail,
        billingAddress: {},
        shippingAddress: {},
        notes: "Customer account deleted",
      },
    },
  );

  await Invite.deleteMany({ inviterId: customer._id });
  await Customer.findByIdAndDelete(id);

  return { message: "Account deleted successfully" };
}

export async function sendInvite(inviterId: string, email: string) {
  const inviter = await Customer.findById(inviterId);
  if (!inviter) throw new AppError(404, "Account not found");

  const normalizedEmail = email.toLowerCase();
  if (normalizedEmail === inviter.email.toLowerCase()) {
    throw new AppError(400, "You cannot invite yourself");
  }

  const existing = await Invite.findOne({ inviterId, email: normalizedEmail });
  if (existing) throw new AppError(409, "You have already invited this email");

  const invite = await Invite.create({ inviterId, email: normalizedEmail });

  return {
    id: String(invite._id),
    email: invite.email,
    status: invite.status,
    createdAt: invite.createdAt,
  };
}

export async function getMyInvites(inviterId: string) {
  const invites = await Invite.find({ inviterId }).sort({ createdAt: -1 });
  const inviteCount = invites.length;

  return {
    inviteCount,
    invites: invites.map((i) => ({
      id: String(i._id),
      email: i.email,
      status: i.status,
      createdAt: i.createdAt,
    })),
  };
}

export async function getInviteLeaderboard() {
  const results = await Invite.aggregate([
    { $group: { _id: "$inviterId", inviteCount: { $sum: 1 } } },
    { $sort: { inviteCount: -1 } },
    {
      $lookup: {
        from: "customers",
        localField: "_id",
        foreignField: "_id",
        as: "customer",
      },
    },
    { $unwind: "$customer" },
    {
      $project: {
        _id: 0,
        id: "$customer._id",
        fullName: "$customer.fullName",
        email: "$customer.email",
        inviteCount: 1,
      },
    },
  ]);

  return results;
}
