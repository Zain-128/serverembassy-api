import { ContactMessage } from "../models/index.js";
import { AppError, mapDoc } from "../lib/errors.js";

export type ContactMessageInput = {
  name: string;
  email: string;
  subject?: string;
  message: string;
};

export async function createContactMessage(input: ContactMessageInput) {
  const doc = await ContactMessage.create(input);
  return mapDoc(doc);
}

export async function listContactMessages() {
  const docs = await ContactMessage.find().sort({ createdAt: -1 }).limit(200);
  return docs.map(mapDoc);
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