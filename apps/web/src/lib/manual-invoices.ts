import "server-only";

import fs from "@/lib/fs-runtime";
import type { ManualInvoice } from "@liksha/types";
import { dataFile } from "./data-dir";
import { dbEnabled } from "./db";
import { appendSheetRows, scriptGet } from "./google-sheets";
import { ordersBackend } from "./orders-sheet";

/**
 * Admin ke manual invoices (kisi bhi naam/address par).
 *
 * Postgres me rehte hain (jab DATABASE_URL ho), warna local JSON. Pehle ye admin
 * container ke local file me the — Render par redeploy se kho jaate the.
 */

type Row = {
  number: string;
  payload: ManualInvoice;
};

function readJson(): ManualInvoice[] {
  const file = dataFile("manual-invoices.json");
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as ManualInvoice[];
  } catch {
    return [];
  }
}

function writeJson(rows: ManualInvoice[]) {
  const file = dataFile("manual-invoices.json");
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 2));
  fs.renameSync(tmp, file);
}

function nextNumber(existing: string[]): string {
  const serial = existing.reduce((max, number) => {
    const value = Number(number.split("/").pop());
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
  return `LK/MANUAL/${String(serial + 1).padStart(4, "0")}`;
}

export async function listManualInvoices(): Promise<ManualInvoice[]> {
  /** R40: sheet hi store hai — Invoices tab ki `Invoice JSON` rows se list. */
  if (ordersBackend() === "sheet") {
    const result = await scriptGet<{ rows?: Record<string, unknown>[] }>(
      "recent",
      { sheet: "Invoices", limit: 100 },
    );
    if (result.ok && Array.isArray(result.data.rows)) {
      return result.data.rows
        .filter((row) => String(row.Type ?? "") === "manual" && String(row["Invoice JSON"] ?? "").trim())
        .map((row) => {
          try {
            return JSON.parse(String(row["Invoice JSON"])) as ManualInvoice;
          } catch {
            return null;
          }
        })
        .filter((invoice): invoice is ManualInvoice => Boolean(invoice && invoice.number));
    }
    // sheet read fail — neeche local fallback
  }
  if (dbEnabled()) {
    const { query } = await import("./db");
    const rows = await query<Row>("select number, payload from manual_invoices order by created_at desc");
    return rows.map((row) => row.payload);
  }
  return readJson();
}

export async function getManualInvoice(number: string): Promise<ManualInvoice | undefined> {
  const rows = await listManualInvoices();
  return rows.find((invoice) => invoice.number === number);
}

export async function createManualInvoice(
  input: Omit<ManualInvoice, "number" | "createdAt" | "subtotal" | "total">,
): Promise<ManualInvoice> {
  const subtotal = input.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const invoice: ManualInvoice = {
    ...input,
    number: nextNumber((await listManualInvoices()).map((row) => row.number)),
    createdAt: new Date().toISOString(),
    subtotal,
    total: subtotal,
  };

  if (ordersBackend() === "sheet") {
    const inr = (paise: number) => Math.round(paise) / 100;
    const ok = await appendSheetRows([
      {
        sheet: "Invoices",
        row: {
          Timestamp: invoice.createdAt,
          "Invoice number": invoice.number,
          "Order number": invoice.orderRef ?? "",
          Type: "manual",
          Customer: invoice.customerName,
          Phone: invoice.phone,
          Email: invoice.email ?? "",
          GSTIN: "",
          Address: [invoice.address, invoice.city, invoice.pincode].filter(Boolean).join(", "),
          State: invoice.state,
          "Taxable value": inr(invoice.subtotal),
          CGST: 0,
          SGST: 0,
          IGST: 0,
          Shipping: 0,
          Discount: 0,
          Total: inr(invoice.total),
          Notes: invoice.notes ?? "",
          "Invoice JSON": JSON.stringify(invoice),
        },
      },
    ]);
    if (ok) return invoice;
    console.warn("[manual-invoices] sheet write fail — local JSON fallback");
  }

  if (dbEnabled()) {
    const { query } = await import("./db");
    await query(
      `insert into manual_invoices
        (number, created_by, customer_name, phone, email, address, city, state, pincode,
         items, notes, order_ref, payload)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13::jsonb)`,
      [
        invoice.number,
        invoice.createdBy,
        invoice.customerName,
        invoice.phone,
        invoice.email ?? null,
        invoice.address,
        invoice.city,
        invoice.state,
        invoice.pincode,
        JSON.stringify(invoice.items),
        invoice.notes ?? null,
        invoice.orderRef ?? null,
        JSON.stringify(invoice),
      ],
    );
    return invoice;
  }

  const rows = readJson();
  rows.unshift(invoice);
  writeJson(rows);
  return invoice;
}
