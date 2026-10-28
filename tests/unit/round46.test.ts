import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  couponExhausted,
  couponExpired,
  couponFromSheetRow,
  couponsFromPayload,
  parseExpiresDate,
  validateCoupon,
  type SheetCoupon,
} from "../../apps/web/src/lib/coupons-format";
import { placedUrl, reviewUrl } from "../../apps/web/src/lib/checkout-session";

/**
 * R46 (owner):
 *   1. "payment ka proper hatana hai … payment ke option ko abhi hold kar do" —
 *      checkout ka step 3 ab **order placed + WhatsApp confirmation** hai.
 *   2. "iss payment ke option mai cuppon ka lga dena" — review step par coupon
 *      (sheet ke Coupons tab se validate, server-side).
 *   3. "jis order ka detailed view check kr rhe hai usko hi direct whatsapp
 *      send kro" — order page par WhatsApp CTA (poori detail ke saath).
 *   4. "every thing in india english … restictly" — customer-facing copy me
 *      Hinglish zero (comments + owner tools chhoot te hain).
 */

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

/**
 * sirf customer-visible code: `// …`, `/* … *\/` aur JSX `{/* … *\/}` comments
 * poore strip (multi-line blocks bhi) — strings ke andar ka text bachta hai.
 */
const codeOnly = (file: string) => {
  const src = read(file);
  let out = "";
  let i = 0;
  /** string ke andar: `${` par nested template/expression recursion */
  const scanString = (quote: string) => {
    out += quote;
    i += 1;
    while (i < src.length) {
      const c = src[i];
      if (c === "\\") {
        out += src[i] + (src[i + 1] ?? "");
        i += 2;
        continue;
      }
      if (quote === "`" && c === "$" && src[i + 1] === "{") {
        out += "${";
        i += 2;
        let depth = 1;
        while (i < src.length && depth > 0) {
          const inner = src[i];
          if (inner === "{" ) { depth += 1; out += inner; i += 1; continue; }
          if (inner === "}") { depth -= 1; if (depth === 0) { out += "}"; i += 1; break; } out += inner; i += 1; continue; }
          if (inner === "\"" || inner === "'" || inner === "`") { scanString(inner); continue; }
          out += inner;
          i += 1;
        }
        continue;
      }
      out += c;
      i += 1;
      if (c === quote) break;
    }
  };
  while (i < src.length) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i += 1;
    } else if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i += 1;
      i += 2;
    } else if (c === "\"" || c === "'" || c === "`") {
      scanString(c);
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
};

const FORM = "apps/web/src/components/checkout-form.tsx";
const ORDER_PAGE = "apps/web/src/app/orders/[orderNumber]/page.tsx";
const GS = "scripts/google-apps-script/liksha-sheets.gs";

/* ─────────────── 1. coupons-format — pure validation ─────────────── */

const coupon = (patch: Partial<SheetCoupon> = {}): SheetCoupon => ({
  code: "SAVE10",
  type: "percent",
  value: 10,
  minOrder: 0,
  maxUses: 0,
  used: 0,
  active: true,
  expires: "",
  ...patch,
});

test("R46: parseExpiresDate — teeno sheet shapes chalte hain, garbage = no expiry", () => {
  const iso = parseExpiresDate("2026-12-31");
  assert.ok(iso && iso.getFullYear() === 2026 && iso.getMonth() === 11 && iso.getDate() === 31);
  const named = parseExpiresDate("31-Dec-2026");
  assert.ok(named && named.getTime() === iso!.getTime(), "dd-MMM-yyyy = yyyy-MM-dd");
  const slash = parseExpiresDate("31/12/2026");
  assert.ok(slash && slash.getTime() === iso!.getTime(), "dd/MM/yyyy bhi wahi din");
  const shortYear = parseExpiresDate("5/Jan/27");
  assert.ok(shortYear && shortYear.getFullYear() === 2027);
  assert.equal(parseExpiresDate(""), null);
  assert.equal(parseExpiresDate("not-a-date"), null, "garbage par expiry nahi maante (coupon galat band na ho)");
});

test("R46: couponExpired / couponExhausted", () => {
  assert.equal(couponExpired(coupon()), false, "khaali expires = kabhi expire nahi");
  assert.equal(couponExpired(coupon({ expires: "2000-01-01" })), true);
  assert.equal(couponExpired(coupon({ expired: true })), true, "script ka flag jeetta hai");
  assert.equal(couponExpired(coupon({ expires: "2099-12-31" })), false);
  assert.equal(couponExhausted(coupon()), false, "maxUses 0 = unlimited");
  assert.equal(couponExhausted(coupon({ maxUses: 5, used: 5 })), true);
  assert.equal(couponExhausted(coupon({ maxUses: 5, used: 4 })), false);
  assert.equal(couponExhausted(coupon({ exhausted: true })), true);
});

test("R46: couponFromSheetRow — sheet headers, case-insensitive, galat row = null", () => {
  const row = couponFromSheetRow({
    Code: "diwali10",
    Type: "Flat",
    Value: "50",
    "Min order": "499",
    "Max uses": "100",
    Used: "7",
    Active: "YES",
    Expires: "31-Dec-2026",
  });
  assert.ok(row);
  assert.equal(row!.code, "DIWALI10");
  assert.equal(row!.type, "flat");
  assert.equal(row!.value, 50);
  assert.equal(row!.minOrder, 499);
  assert.equal(row!.maxUses, 100);
  assert.equal(row!.used, 7);
  assert.equal(row!.active, true);
  assert.equal(couponFromSheetRow({ Code: "" }), null, "bina code row null");
  assert.equal(couponFromSheetRow(null), null);
  const list = couponsFromPayload({ coupons: [{ Code: "A" }, { nope: 1 }, { code: "b" }] });
  assert.deepEqual(list.map((c) => c.code), ["A", "B"], "payload me se sirf valid rows");
  assert.deepEqual(couponsFromPayload({ data: [{ code: "X" }] }).length, 1, "data[] shape bhi chalta hai");
  assert.deepEqual(couponsFromPayload("junk"), []);
});

test("R46: validateCoupon — percent/flat discount paisa me, English messages", () => {
  const coupons = [
    coupon({ code: "SAVE10", type: "percent", value: 10, minOrder: 500 }),
    coupon({ code: "FLAT50", type: "flat", value: 50, minOrder: 499 }),
    coupon({ code: "OFF", active: false }),
    coupon({ code: "OLD", expires: "2000-01-01" }),
    coupon({ code: "FULL", maxUses: 2, used: 2 }),
  ];
  const ok = validateCoupon(coupons, "save10", 100000);
  assert.equal(ok.ok, true);
  assert.equal(ok.ok && ok.discountPaise, 10000, "10% of Rs.1000 = Rs.100");
  assert.match(ok.ok ? ok.message : "", /you saved Rs\. 100\b/, "message English + amount");

  const flat = validateCoupon(coupons, "FLAT50", 60000);
  assert.equal(flat.ok && flat.discountPaise, 5000, "flat Rs.50 = 5000 paisa");

  assert.match(validateCoupon(coupons, "", 100).ok ? "" : (validateCoupon(coupons, "", 100) as { error: string }).error, /Enter a coupon code\./);
  assert.match(JSON.stringify(validateCoupon(coupons, "NOPE", 100)), /is not valid/);
  assert.match(JSON.stringify(validateCoupon(coupons, "OFF", 100)), /no longer active/);
  assert.match(JSON.stringify(validateCoupon(coupons, "OLD", 100)), /has expired/);
  assert.match(JSON.stringify(validateCoupon(coupons, "FULL", 100)), /usage limit/);
  // min-order short — English + exact shortfall amount
  const short = validateCoupon(coupons, "FLAT50", 40000);
  assert.equal(short.ok, false);
  assert.match(short.ok ? "" : short.error, /minimum order of Rs\. 499/);
  assert.match(short.ok ? "" : short.error, /Add Rs\. 99 more/, "shortfall batata hai");
  // flat discount subtotal se bada nahi ho sakta
  const capped = validateCoupon([coupon({ code: "BIG", type: "flat", value: 900 })], "BIG", 50000);
  assert.equal(capped.ok && capped.discountPaise, 50000, "discount ≤ subtotal");
  // percent clamp 0–100
  const clamped = validateCoupon([coupon({ code: "WILD", value: 250 })], "WILD", 10000);
  assert.equal(clamped.ok && clamped.discountPaise, 10000, "250% clamp hokar 100%");
  const zero = validateCoupon([coupon({ code: "ZERO", value: 0 })], "ZERO", 10000);
  assert.equal(zero.ok, false, "0 discount = not applicable");
});

/* ─────────────── 2. checkout architecture — payment hold + placed step ─────────────── */

test("R46: placedUrl/reviewUrl — step 3 ka URL", () => {
  assert.equal(placedUrl("LK-ABC123"), "/checkout?step=placed&order=LK-ABC123");
  assert.equal(reviewUrl("LK-ABC123"), "/checkout?step=review&order=LK-ABC123");
});

test("R46: checkout me payment step nahi — step 3 = order placed + WhatsApp", () => {
  const form = codeOnly(FORM);
  assert.ok(!form.includes("CheckoutPaymentStep"), "payment component import/render nahi");
  assert.ok(!/goToPayment|paymentUrl\(/.test(form), "payment navigation gaya");
  assert.match(form, /const isPlaced = step === "placed" && Boolean\(orderNumber\)/);
  assert.match(form, /data-testid="placed-whatsapp"/);
  assert.match(form, /Send order on WhatsApp/);
  assert.match(form, /Order placed!/);
  // hold note — payment baad me, customer ko saaf English me
  assert.match(form, /Online payment is (currently paused|paused at the moment)/);
  // purane ?step=payment links bhi placed par hi khulte hain (compat)
  assert.match(read(FORM), /searchParams\.get\("step"\) === "payment"/);
});

test("R46: placed WhatsApp message me poori order detail (items + links + qty + price + total + address)", () => {
  const form = read(FORM);
  assert.match(form, /function orderWhatsAppHref\(target\?: string\): string/);
  assert.match(form, /productUrl\(/, "har item ka product link");
  assert.match(form, /whatsappLink\(/, "number sheet se — hardcode nahi");
  assert.match(form, /Please confirm my order/);
  // order POST ke baad window.open attempt + visible tap button (popup block safe)
  assert.match(form, /window\.open\(waHref, "_blank", "noopener,noreferrer"\)/);
  assert.match(form, /placedWaHref/);
  // snapshot me handle save hota hai (link banane ke liye)
  assert.match(form, /handle: line\.handle/);
  const session = read("apps/web/src/lib/checkout-session.ts");
  assert.match(session, /handle\?: string/);
});

test("R46.5: review ka CTA hi direct WhatsApp send hai — 'Place order' nahi", () => {
  const form = read(FORM);
  assert.match(form, /Send order on WhatsApp · \$\{formatPrice\(total\)\}/, "final CTA = WhatsApp send");
  assert.ok(!/Place order ·/.test(form), "purana 'Place order' CTA gaya");
  assert.match(form, /label: "WhatsApp"/, "step 3 indicator = WhatsApp");
  // order phir bhi sheet me banta hai (tracking data safe) — WhatsApp ke saath-saath
  assert.match(form, /data-testid="checkout-submit"/);
});

test("R46.5: product page + cart par 'Order on WhatsApp' (Buy it now ke side)", () => {
  const pdp = read("apps/web/src/components/product-detail.tsx");
  assert.match(pdp, /data-testid="buy-now"/);
  assert.match(pdp, /data-testid="pdp-whatsapp-order"/, "Buy it now ke side WhatsApp order button");
  assert.match(pdp, /Order on WhatsApp/);
  // detailed message: title + colour + size + qty + price + link + confirm line
  assert.match(pdp, /Colour: \$\{active\.name\}/);
  assert.match(pdp, /Size: \$\{size\}/);
  assert.match(pdp, /Quantity: \$\{quantity\}/);
  assert.match(pdp, /Please confirm my order and share the payment details\./);
  const cart = read("apps/web/src/app/cart/page.tsx");
  assert.match(cart, /cartWhatsAppMessage/, "cart/bag se bhi direct WhatsApp order");
});

test("R46.5: WhatsApp number sheet se; dev/CI preview ke liye STORE_WHATSAPP env (production me nahi)", () => {
  const settings = read("apps/web/src/lib/store-settings.ts");
  assert.match(settings, /whatsapp: process\.env\.STORE_WHATSAPP \?\? ""/);
  assert.match(settings, /supportPhone: process\.env\.STORE_WHATSAPP \?\? ""/);
  // source me number hardcode nahi — sirf env (R45 guard allowlist tootta nahi)
  assert.ok(!/8005900581/.test(settings), "koi hardcoded number nahi");
});

test("R46: coupon checkout me payment ki jagah — review step par", () => {
  const form = read(FORM);
  assert.match(form, /data-testid="coupon-box"/);
  assert.match(form, /data-testid="coupon-input"/);
  assert.match(form, /data-testid="coupon-apply"/);
  assert.match(form, /data-testid="coupon-remove"/);
  assert.match(form, /data-testid="coupon-status"/);
  assert.match(form, /Have a coupon\?/);
  assert.match(form, /\/api\/coupons\/check\?code=/);
  assert.match(form, /async function applyCoupon\(\): Promise<boolean>/, "submit stale-state se nahi phasta");
  // R48/R52: coupon fail par submit abort — WhatsApp instant-open se PEHLE hi
  assert.match(
    form,
    /const applied = await applyCoupon\(\);\s*\n\s*if \(!applied\) return;/,
  );
  assert.match(form, /couponCode: coupon\?\.code \?\? null/, "order POST me couponCode");
  assert.match(form, /data-testid="summary-discount"/, "aside me discount row");
});

test("R46: order create me coupon SERVER-side validate hota hai (client par bharosa nahi)", () => {
  const lib = read("apps/web/src/lib/orders.ts");
  // R53: readCoupons prefetch import me juda (parallel warm-up) — validate server-side hi
  assert.match(lib, /import \{ checkCouponCode, readCoupons, reportCouponUse \} from "\.\/coupons-sheet"/);
  assert.match(lib, /await checkCouponCode\(/);
  assert.match(lib, /coupon_invalid/, "invalid coupon = 400, order nahi banta");
  assert.match(lib, /reportCouponUse\(order\.couponCode\)/, "order banne ke baad sheet me Used +1");
  assert.match(lib, /runInBackground|reportCouponUse/, "use-count order ko rokta nahi");
  const route = read("apps/web/src/app/api/coupons/check/route.ts");
  assert.match(route, /export async function GET/);
  assert.match(route, /Math\.min\(Math\.max\(Math\.round\(subtotalRaw\), 0\), 100_000_000\)/, "subtotal clamp");
  assert.match(route, /"cache-control": "no-store"/);
  const sheetLib = read("apps/web/src/lib/coupons-sheet.ts");
  assert.match(sheetLib, /COUPONS_TTL_MS = 30_000/, "30s TTL");
  assert.match(sheetLib, /ok: true,\s*\n\s*discountPaise: 0,/, "sheet unavailable = lenient (order nahi rukta)");
  assert.match(sheetLib, /process\.env\.NODE_ENV !== "development" \|\| sheetsConfigured\(\)/, "demo coupons sirf dev me, sheet ke bina");
});

/* ─────────────── 3. Apps Script r46-1 — Coupons actions ─────────────── */

test("R46: gs r46-1 — coupons public read + coupon_use (Used +1)", () => {
  const gs = read(GS);
  assert.match(gs, /var CODE_VERSION = 'r46-1';/);
  assert.match(gs, /action === 'coupons'/, "doGet me coupons handler");
  assert.match(gs, /action === 'coupons';|action === 'reviews' \|\| action === 'coupons'/, "coupons public action hai (bina token bhi chale)");
  assert.match(gs, /function readCoupons_\(/);
  assert.match(gs, /function couponExpired_\(/);
  assert.match(gs, /function couponUse_\(/);
  assert.match(gs, /action === 'coupon_use'/, "doPost me coupon_use");
  // public read sirf active+valid coupons deta hai; authed ko sab
  assert.match(gs, /couponsAuthed/, "token ke saath poori list");
});

/* ─────────────── 4. order page — direct WhatsApp send + payment hold ─────────────── */

test("R46: order detail page — direct WhatsApp send + payment CTA hold", () => {
  const page = read(ORDER_PAGE);
  assert.match(page, /data-testid="confirm-whatsapp"/, "top CTA");
  assert.match(page, /Send order on WhatsApp/, "bottom CTA");
  assert.match(page, /orderWhatsAppLink\(order, siteUrl, waPhone\)/);
  assert.doesNotMatch(page, /data-testid="complete-payment"/, "payment hold: CTA hataya");
  assert.match(page, /data-testid="payment-hold-note"/);
  assert.match(page, /data-testid="hold-whatsapp"/, "hold note me bhi WhatsApp raasta");
  const wa = read("apps/web/src/lib/whatsapp.ts");
  assert.match(wa, /Please confirm my order and share the payment details\./);
  assert.match(wa, /orderWhatsAppMessage/, "poori detail: items + links + qty + price + total + address");
});

/* ─────────────── 5. STRICT English guard — customer-facing files ─────────────── */

test("R46: customer-facing copy strictly English — koi Hinglish nahi (owner rule)", () => {
  const HINGLISH =
    /\b(kariye|karein|kijiye|dabaiye|dabate|khulega|khulti|kholein|kholiye|aayega|aayegi|milega|milegi|dikhega|dikhegi|hoga|hogi|nahi|yahan|wahan|bhejein|bhej dijiye|likhiye|dekhein|dekhiye|chuka|chuki|raha hai|rahi hai|shukriya|dhanyavad|muft|bilkul|chalu|turant|paisa|paise kat|wapas|aapka|aapki|hum|hamari|jaldi|pehle se|grahak|dukan|bhar dijiye|bhara|bhare|chuna|der se|samay|dein|lein|rakhein|bhool|galat|sahi hai|tez|chalega|hota hai|hoti hai|hain|likh dijiye|bhej dijiye|manga|kaam|jaayega|jaata hai|jaati hai|dijiye|chuniye|badliye|pahunch|bachayein|sambhal|pareshani|zaroori|zaroorat|mauka|fayda|nuksan|tayyar|taiyaar|shuru|khatam|intezaar|ho gaya|ho gayi|ho chuka|ho chuki|ho jaata|ho jaati|ho jayega|abhi|koi bhi|kuch nahi|dobara|thodi der|baad me|Sawaal|sawaal|koshish|Bacha|bacha|Bik|bik|Chuna|Mila|mila hai|Nahi)\b/i;

  const customerFiles = [
    "apps/web/src/components/checkout-form.tsx",
    "apps/web/src/components/checkout-payment-step.tsx",
    "apps/web/src/components/payment-status-watcher.tsx",
    "apps/web/src/components/upi-payment.tsx",
    "apps/web/src/components/product-reviews.tsx",
    "apps/web/src/components/contact-form.tsx",
    "apps/web/src/components/track-order-form.tsx",
    "apps/web/src/components/site-header.tsx",
    "apps/web/src/components/site-footer.tsx",
    "apps/web/src/components/product-card.tsx",
    "apps/web/src/components/product-detail.tsx",
    "apps/web/src/components/collection-browser.tsx",
    "apps/web/src/components/product-grid-client.tsx",
    "apps/web/src/components/best-sellers-rail.tsx",
    "apps/web/src/app/orders/[orderNumber]/page.tsx",
    "apps/web/src/app/orders/[orderNumber]/pay/page.tsx",
    "apps/web/src/app/orders/[orderNumber]/not-found.tsx",
    "apps/web/src/app/orders/[orderNumber]/error.tsx",
    "apps/web/src/app/account/page.tsx",
    "apps/web/src/app/compare/page.tsx",
    "apps/web/src/app/wishlist/page.tsx",
    "apps/web/src/app/policies/[slug]/page.tsx",
    "apps/web/src/lib/http-json.ts",
    "apps/web/src/lib/tracking.ts",
    "apps/web/src/lib/coupons-format.ts",
    "apps/web/src/lib/coupons-sheet.ts",
    "apps/web/src/lib/whatsapp.ts",
    "apps/web/src/app/api/coupons/check/route.ts",
    "apps/web/src/app/api/reviews/route.ts",
    "apps/web/src/app/api/orders/route.ts",
    "apps/web/src/app/api/otp/verify/route.ts",
    "apps/web/src/app/api/payments/claim/route.ts",
  ];
  const offenders: string[] = [];
  for (const file of customerFiles) {
    const lines = codeOnly(file).split("\n");
    lines.forEach((line, index) => {
      // code identifiers/props me Hinglish nahi hoti — sirf string/JSX text pakdo
      const match = HINGLISH.exec(line);
      if (match) offenders.push(`${file}:${index + 1} [${match[1]}] ${line.trim().slice(0, 110)}`);
    });
  }
  assert.deepEqual(offenders, [], "customer-facing files me Hinglish copy mili:\n" + offenders.join("\n"));
});

test("R46: gs owner panel Hinglish reh sakta hai (owner tool) — site nahi", () => {
  const gs = read(GS);
  // owner ka control panel Hinglish hi rahega (R40 decision, R46 me bhi wahi)
  assert.match(gs, /controlPanel_|function buildPanel_|html_/i, "owner panel gs me maujood");
});
