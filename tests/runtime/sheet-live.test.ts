/**
 * R35 — "Sheet me UPI badla, site par turant aana chahiye".
 *
 * Owner ki shikayat thi ki Google Sheet ki Settings tab me UPI badalne ke baad bhi
 * site purana UPI dikhati rehti thi. Is file me asli code path (fetch → parse →
 * merge → cache → API) chalaya jaata hai, sirf `fetch` stub hota hai — yaani
 * network ke bina, par bilkul wahi logic jo production me chalta hai.
 *
 * `server-only` wale modules hain, isliye ye suite react-server condition ke saath
 * chalti hai: `npm run test:runtime`.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { isolate } from "../helpers/env.ts";

const dataDir = isolate("sheet-live");

// Test ke dauraan Postgres kabhi na khule — sirf file store
delete process.env.DATABASE_URL;
delete process.env.DATABASE_URL_POOLED;
delete process.env.GOOGLE_SHEETS_SETTINGS_CSV_URL;

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbTEST/exec";
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-TEST/pub?gid=0&single=true&output=csv";
process.env.GOOGLE_SHEETS_WEBAPP_URL = SCRIPT_URL;
process.env.GOOGLE_SHEETS_TOKEN = "test-sheet-token";
process.env.STORE_UPI_ID = "purana@upi";

type Call = { url: string; init?: RequestInit };
const calls: Call[] = [];
let responder: (call: Call) => Promise<Response> | Response = () => new Response("{}");

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const call = { url: String(input), init };
  calls.push(call);
  return responder(call);
}) as typeof fetch;

test.after(() => {
  globalThis.fetch = realFetch;
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function htmlResponse() {
  return new Response("<!DOCTYPE html><html><body>Sign in</body></html>", {
    status: 200,
    headers: { "content-type": "text/html" },
  });
}

async function runtime() {
  const settings = await import("../../apps/web/src/lib/store-settings.ts");
  const sheets = await import("../../apps/web/src/lib/google-sheets.ts");
  return { ...settings, ...sheets };
}

test("sheet me 'UPI ID' likha ho to bhi wahi UPI site par aata hai", async () => {
  const { getStoreSettings, invalidateSheetSettings, resetStoreSettingsCache } = await runtime();
  invalidateSheetSettings();
  resetStoreSettingsCache();
  calls.length = 0;
  responder = () =>
    jsonResponse({ ok: true, settings: { announcement: "Diwali Sale", "UPI ID": "naya@okaxis" } });

  const settings = await getStoreSettings({ fresh: true });
  assert.equal(settings.upiId, "naya@okaxis", "sheet ka naya UPI jeetna chahiye");
  assert.equal(settings.announcement, "Diwali Sale");

  const url = new URL(calls[0]!.url);
  assert.equal(url.searchParams.get("action"), "settings");
  assert.equal(url.searchParams.get("token"), "test-sheet-token");
  assert.ok(url.searchParams.get("_"), "cache-buster bhejna chahiye (purana jawab na aaye)");
});

test("/api/settings sheet ka sach batata hai (source + diagnostics)", async () => {
  const { getStoreSettings } = await import("../../apps/web/src/lib/store-settings.ts");
  const { GET } = await import("../../apps/web/src/app/api/settings/route.ts");
  responder = () => jsonResponse({ ok: true, settings: { "UPI ID": "naya@okaxis" } });

  const response = await GET(new Request("https://designerclothing.fashion/api/settings?fresh=1"));
  const body = (await response.json()) as {
    data: { upiId: string; source: string; sheet: { configured: boolean; readFrom: string | null; stale: boolean } };
  };
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(body.data.upiId, "naya@okaxis");
  assert.equal(body.data.source, "google-sheet");
  assert.equal(body.data.sheet.configured, true);
  assert.equal(body.data.sheet.readFrom, "apps-script");
  assert.equal(body.data.sheet.stale, false);
  await getStoreSettings({ fresh: true });
});

test("default /api/settings 15s cache use karta hai (Apps Script quota na jaye)", async () => {
  const { GET } = await import("../../apps/web/src/app/api/settings/route.ts");
  const { getStoreSettings, invalidateSheetSettings, resetStoreSettingsCache } = await runtime();
  invalidateSheetSettings();
  resetStoreSettingsCache();
  responder = () => jsonResponse({ ok: true, settings: { "UPI ID": "cache@okaxis" } });
  await getStoreSettings({ fresh: true });

  calls.length = 0;
  for (let i = 0; i < 3; i += 1) {
    const response = await GET(new Request("https://designerclothing.fashion/api/settings"));
    const body = (await response.json()) as { data: { upiId: string } };
    assert.equal(body.data.upiId, "cache@okaxis");
  }
  assert.equal(calls.length, 0, "15s ke andar sheet dobara nahi padhi jaani chahiye");
});

test("sheet down ho jaye to bhi purana UPI nahi — last known sheet value rehti hai", async () => {
  const { getStoreSettings, invalidateSheetSettings, resetStoreSettingsCache, settingsSheetStatus } =
    await runtime();
  invalidateSheetSettings();
  resetStoreSettingsCache();

  // pehle ek successful read — naya UPI cache ho jaata hai
  responder = () => jsonResponse({ ok: true, settings: { "UPI ID": "naya@okaxis" } });
  assert.equal((await getStoreSettings({ fresh: true })).upiId, "naya@okaxis");

  // ab sheet fail — site par **naya** UPI hi rehna chahiye, env ka purana nahi
  invalidateSheetSettings();
  resetStoreSettingsCache();
  calls.length = 0;
  responder = () => {
    throw new Error("getaddrinfo ENOTFOUND script.google.com");
  };

  const settings = await getStoreSettings({ fresh: true });
  assert.equal(settings.upiId, "naya@okaxis", "fail par last-known-good sheet value");
  assert.notEqual(settings.upiId, "purana@upi");

  const status = settingsSheetStatus();
  assert.equal(status.source, null);
  assert.match(String(status.error), /ENOTFOUND|script\.google\.com/i);
});

test("Apps Script HTML (login page) de to error saaf batata hai", async () => {
  const { readSheetSettingsDetailed, invalidateSheetSettings } = await runtime();
  invalidateSheetSettings();
  delete process.env.GOOGLE_SHEETS_SETTINGS_CSV_URL;
  responder = () => htmlResponse();

  const read = await readSheetSettingsDetailed({ fresh: true });
  assert.equal(read.settings, null);
  assert.equal(read.source, null);
  assert.match(String(read.error), /HTML/i);
});

test("token galat ho (ok:false) to script ka error message aata hai", async () => {
  const { readSheetSettingsDetailed, invalidateSheetSettings } = await runtime();
  invalidateSheetSettings();
  delete process.env.GOOGLE_SHEETS_SETTINGS_CSV_URL;
  responder = () => jsonResponse({ ok: false, error: "unauthorized — token match nahi hua" });

  const read = await readSheetSettingsDetailed({ fresh: true });
  assert.equal(read.settings, null);
  assert.match(String(read.error), /token match nahi hua/);
});

test("Apps Script down ho to published CSV se UPI aa jaata hai", async () => {
  const { readSheetSettingsDetailed, invalidateSheetSettings } = await runtime();
  invalidateSheetSettings();
  process.env.GOOGLE_SHEETS_SETTINGS_CSV_URL = CSV_URL;
  responder = (call) => {
    if (call.url.startsWith(CSV_URL.split("?")[0]!)) {
      return new Response("key,value\nannouncement,CSV Sale\nUPI ID,csv@ybl\n", {
        status: 200,
        headers: { "content-type": "text/csv" },
      });
    }
    return jsonResponse({ ok: false, error: "script down" });
  };

  const read = await readSheetSettingsDetailed({ fresh: true });
  assert.equal(read.source, "csv");
  assert.equal(read.settings?.upiId, "csv@ybl");
  delete process.env.GOOGLE_SHEETS_SETTINGS_CSV_URL;
});

test("sheet me galat UPI (bina @) ho to site tootti nahi — pehli value rehti hai", async () => {
  const { getStoreSettings, invalidateSheetSettings, resetStoreSettingsCache } = await runtime();
  invalidateSheetSettings();
  resetStoreSettingsCache();
  responder = () => jsonResponse({ ok: true, settings: { "UPI ID": "naya@okaxis" } });
  assert.equal((await getStoreSettings({ fresh: true })).upiId, "naya@okaxis");

  invalidateSheetSettings();
  resetStoreSettingsCache();
  responder = () => jsonResponse({ ok: true, settings: { "UPI ID": "ye galat hai" } });
  const settings = await getStoreSettings({ fresh: true });
  assert.equal(settings.upiId, "naya@okaxis", "galat value se UPI kabhi na badle");
});

test("payment page (fast path) bhi sheet ka UPI deta hai, env default nahi", async () => {
  const { getStoreSettings, getStoreSettingsFast, invalidateSheetSettings, resetStoreSettingsCache } =
    await runtime();
  invalidateSheetSettings();
  resetStoreSettingsCache();

  // pehle sheet se naya UPI
  responder = () => jsonResponse({ ok: true, settings: { "UPI ID": "fast@paytm" } });
  await getStoreSettings({ fresh: true });

  // sheet hang ho jaye — budget khatam par last-known-good hi mile
  invalidateSheetSettings();
  resetStoreSettingsCache();
  responder = () =>
    new Promise<Response>((_resolve, reject) => {
      setTimeout(() => reject(new Error("Apps Script slow (12s timeout jaisa)")), 150);
    });
  const fast = await getStoreSettingsFast(25);
  assert.equal(fast.upiId, "fast@paytm", "payment page par bhi sheet ka UPI");
});

test("sheet cache disk par likha jaata hai (restart ke baad bhi kaam aaye)", async () => {
  const { getStoreSettings, invalidateSheetSettings, resetStoreSettingsCache } = await runtime();
  invalidateSheetSettings();
  resetStoreSettingsCache();
  responder = () => jsonResponse({ ok: true, settings: { "UPI ID": "disk@axis" } });
  await getStoreSettings({ fresh: true });

  const file = path.join(dataDir, "sheet-settings.json");
  assert.ok(fs.existsSync(file), "last-known-good sheet settings disk par honi chahiye");
  const saved = JSON.parse(fs.readFileSync(file, "utf8")) as { settings: { upiId?: string } };
  assert.equal(saved.settings.upiId, "disk@axis");
});

test("admin panel se UPI save karo aur sheet down ho — phir bhi owner ka naya UPI", async () => {
  const { getStoreSettings, saveStoreSettings, invalidateSheetSettings, resetStoreSettingsCache } =
    await runtime();
  invalidateSheetSettings();
  resetStoreSettingsCache();

  // sheet down
  responder = () => {
    throw new Error("sheet down");
  };
  const saved = await saveStoreSettings(
    { upiId: "admin@okhdfcbank", upiName: "Designer Clothing", supportPhone: "8005900581" },
    "owner",
  );
  assert.equal(saved.upiId, "admin@okhdfcbank");

  invalidateSheetSettings();
  resetStoreSettingsCache();
  const settings = await getStoreSettings({ fresh: true });
  assert.equal(settings.upiId, "admin@okhdfcbank", "admin ka save sheet fail par bhi jeetna chahiye");
});
