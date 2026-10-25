import { NextResponse } from "next/server";
import { EXPECTED_SHEET_ID } from "@/lib/google-sheets";

/**
 * Sheet write selftest — **sirf debugging ke liye**, secret key ke bina band.
 *
 * Kyun: Apps Script web app ko call karne wala code Vercel par chalta hai, isliye
 * sheet me row na aaye to asli wajah (URL missing / token mismatch / redirect /
 * permission) yahin se dikhti hai — browser me kholkar.
 *
 * Use: `/api/sheet-selftest?key=<SHEET_SELFTEST_KEY>&sheet=Audit`
 *  - `SHEET_SELFTEST_KEY` env Vercel me set hai; bina key ke route 404 deta hai
 *    (public repo me key nahi hai).
 *  - Ye tab me **ek selftest row** likhta hai (Audit), order data nahi chhoota.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const AUDIT_TAB = "Audit";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = (process.env.SHEET_SELFTEST_KEY ?? "").trim();
  if (!key || url.searchParams.get("key") !== key) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  const config = (process.env.GOOGLE_SHEETS_WEBAPP_URL ?? "").trim();
  const token = (process.env.GOOGLE_SHEETS_TOKEN ?? "").trim();
  const result: Record<string, unknown> = {
    urlSet: Boolean(config),
    urlHost: config ? new URL(config).host : null,
    tokenSet: Boolean(token),
    tokenLength: token.length,
  };
  if (!config) return NextResponse.json({ ok: false, ...result });

  // 1) read check — script zinda hai? kaun si sheet pakad raha hai?
  const startedRead = Date.now();
  try {
    const health = new URL(config);
    health.searchParams.set("action", "health");
    if (token) health.searchParams.set("token", token);
    const response = await fetch(health, {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    const raw = await response.text();
    result.read = { status: response.status, ms: Date.now() - startedRead, body: raw.slice(0, 600) };
    /**
     * Sabse zaroori check: script **kaun si sheet** pakde hue hai?
     * Mismatch = rows kisi doosri (copy) sheet me jaa rahe hain.
     */
    try {
      const parsed = JSON.parse(raw) as {
        spreadsheet?: string;
        spreadsheetId?: string;
        sheets?: { name?: string; rows?: number }[];
      };
      result.book = {
        name: parsed.spreadsheet ?? null,
        id: parsed.spreadsheetId ?? null,
        expectedId: EXPECTED_SHEET_ID,
        match: parsed.spreadsheetId ? parsed.spreadsheetId === EXPECTED_SHEET_ID : null,
        rows: Object.fromEntries((parsed.sheets ?? []).map((entry) => [entry.name ?? "?", Number(entry.rows ?? 0)])),
      };
    } catch {
      result.book = { parseError: true, expectedId: EXPECTED_SHEET_ID };
    }
  } catch (error) {
    result.read = { error: (error as Error).message, ms: Date.now() - startedRead };
  }

  // 2) write check — ek row Audit tab me (yahi asli append path hai)
  const sheet = url.searchParams.get("sheet") === "Orders" ? "Orders" : AUDIT_TAB;
  const startedWrite = Date.now();
  try {
    const response = await fetch(config, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "text/plain;charset=utf-8", accept: "application/json" },
      body: JSON.stringify({
        token,
        action: "append",
        rows: [
          {
            sheet,
            row:
              sheet === "Orders"
                ? {
                    Timestamp: new Date().toISOString(),
                    Event: "selftest",
                    "Order number": "SELFTEST",
                    "Order status": "placed",
                    "Payment status": "pending",
                    "Payment method": "upi",
                    Customer: "selftest",
                    Notes: "api/sheet-selftest se likha gaya",
                  }
                : {
                    Timestamp: new Date().toISOString(),
                    Actor: "selftest",
                    Action: "sheet_write_check",
                    Target: sheet,
                    Details: "api/sheet-selftest se likha gaya",
                  },
          },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    result.write = {
      status: response.status,
      redirected: response.redirected,
      finalUrlHost: new URL(response.url).host,
      ms: Date.now() - startedWrite,
      body: (await response.text()).slice(0, 600),
    };
  } catch (error) {
    result.write = { error: (error as Error).message, ms: Date.now() - startedWrite };
  }

  return NextResponse.json({ ok: true, sheet, ...result });
}
