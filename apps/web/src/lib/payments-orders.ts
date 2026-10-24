import "server-only";

import fs from "node:fs";
import type { Order } from "@liksha/types";
import { dataFile } from "@/lib/data-dir";

/** Payments routes ke liye read-only access — orders.ts ka poora API expose karne ki zaroorat nahi. */
export function getOrderForPayment(orderNumber: string): Order | null {
  const file = dataFile("orders.json");
  if (!fs.existsSync(file)) return null;
  try {
    const orders = JSON.parse(fs.readFileSync(file, "utf8")) as Order[];
    return orders.find((order) => order.orderNumber === orderNumber) ?? null;
  } catch {
    return null;
  }
}
