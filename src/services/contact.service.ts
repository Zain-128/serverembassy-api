import { ContactMessage } from "../models/index.js";
import { AppError, mapDoc } from "../lib/errors.js";
import { paginate, totalPagesOf, type PaginationQuery } from "../lib/paginate.js";

export type ContactMessageInput = {
  name: string;
  email: string;
  subject?: string;
  message: string;
  store?: string;
  type?: string;
};

export async function createContactMessage(input: ContactMessageInput) {
  const storeType = input.type || input.store || "serverembassy";
  const doc = await ContactMessage.create({
    ...input,
    store: storeType,
    type: storeType,
  });
  return mapDoc(doc);
}

export async function listContactMessages(filterParam?: { store?: string; type?: string }) {
  const filter: Record<string, unknown> = {};
  const target = filterParam?.type || filterParam?.store;
  if (target && target !== "all") {
    filter.$or = [{ store: target }, { type: target }];
  }
  const docs = await ContactMessage.find(filter).sort({ createdAt: -1 }).limit(200);
  return docs.map(mapDoc);
}

export async function listContactMessagesPaginated(query: PaginationQuery & { store?: string; type?: string }) {
  const { page, limit, skip } = paginate(query);
  const filter: Record<string, unknown> = {};
  const target = query.type || query.store;
  if (target && target !== "all") {
    filter.$or = [{ store: target }, { type: target }];
  }
  const [docs, total] = await Promise.all([
    ContactMessage.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ContactMessage.countDocuments(filter),
  ]);
  return {
    items: docs.map(mapDoc),
    total,
    page,
    limit,
    totalPages: totalPagesOf(total, limit),
  };
}

export async function markContactMessageRead(id: string, read: boolean) {
  if (!id.match(/^[0-9a-fA-F]{24}$/)) throw new AppError(404, "Message not found");
  const doc = await ContactMessage.findByIdAndUpdate(id, { read }, { new: true });
  if (!doc) throw new AppError(404, "Message not found");
  return mapDoc(doc);
}

export async function deleteContactMessage(id: string) {
  if (!id.match(/^[0-9a-fA-F]{24}$/)) throw new AppError(404, "Message not found");
  const result = await ContactMessage.findByIdAndDelete(id);
  if (!result) throw new AppError(404, "Message not found");
}