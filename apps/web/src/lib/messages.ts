import "server-only";

import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { dataFile } from "@/lib/data-dir";

export interface ContactMessage {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  phone?: string | null;
  message: string;
  handled: boolean;
}

export interface Subscriber {
  id: string;
  createdAt: string;
  email: string;
}

function readJson<T>(name: string): T[] {
  const file = dataFile(name);
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T[];
  } catch {
    return [];
  }
}

function writeJson<T>(name: string, rows: T[]) {
  const file = dataFile(name);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 2));
  fs.renameSync(tmp, file);
}

export function saveMessage(input: Omit<ContactMessage, "id" | "createdAt" | "handled">) {
  const rows = readJson<ContactMessage>("messages.json");
  const message: ContactMessage = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    handled: false,
    ...input,
  };
  rows.unshift(message);
  writeJson("messages.json", rows);
  return message;
}

export function saveSubscriber(email: string) {
  const rows = readJson<Subscriber>("newsletter.json");
  if (rows.some((row) => row.email === email)) return { duplicate: true as const };
  rows.unshift({ id: randomUUID(), createdAt: new Date().toISOString(), email });
  writeJson("newsletter.json", rows);
  return { duplicate: false as const };
}
