/**
 * R33 guards — naya domain + checkout back-navigation.
 *
 * Owner (26 Oct 2026):
 *   1. Domain `designerclothing.fashion` khareed liya → poori site usi ke hisaab se.
 *   2. Flow: address (step 1) → review (step 2) → payment (step 3) — checkout
 *      karte hi pehle address, phir review, phir payment.
 *   3. Payment se **back** karne par review (step 2) par aana chahiye.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { CANONICAL_ADMIN_ORIGIN, CANONICAL_ORIGIN, isOwnHost } from "../../apps/web/src/lib/domain";
import { LIVE_STORE_URL } from "../../apps/web/src/lib/api-base";
import { normaliseReferrer } from "../../apps/web/src/lib/traffic-format";
import { readPlacedOrder, reviewUrl, savePlacedOrder, clearPlacedOrder } from "../../apps/web/src/lib/checkout-session";

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), "utf8");

test("R33: canonical origin naya domain hai", () => {
  assert.equal(CANONICAL_ORIGIN, "https://designerclothing.fashion");
  assert.equal(CANONICAL_ADMIN_ORIGIN, "https://admin.designerclothing.fashion");
});

test("R33: site config ka fallback naya domain hai (purana/borrowed site kabhi nahi)", () => {
  const site = read("apps/web/src/config/site.ts");
  assert.match(site, /CANONICAL_ORIGIN/);
  assert.doesNotMatch(site, /"https:\/\/www\.likshaclothing\.com"/);
});

test("R33: live store fallback bhi naya domain", () => {
  if (!process.env.NEXT_PUBLIC_LIVE_STORE_URL && !process.env.NEXT_PUBLIC_API_BASE_URL) {
    assert.equal(LIVE_STORE_URL, CANONICAL_ORIGIN);
  }
  assert.match(read("apps/web/src/lib/api-base.ts"), /CANONICAL_ORIGIN/);
});

test("R33: apne hosts pehchane jaate hain (www + purana vercel URL)", () => {
  assert.equal(isOwnHost("designerclothing.fashion"), true);
  assert.equal(isOwnHost("www.designerclothing.fashion"), true);
  assert.equal(isOwnHost("https://designerclothing.fashion/checkout"), true);
  assert.equal(isOwnHost("liksha-clothing.vercel.app"), true);
  assert.equal(isOwnHost("www.likshaclothing.com"), false);
  assert.equal(isOwnHost("google.com"), false);
  assert.equal(isOwnHost(null), false);
});

test("R33: traffic me naya domain internal gina jaata hai", () => {
  assert.equal(normaliseReferrer("https://designerclothing.fashion/products/x"), "internal");
  assert.equal(normaliseReferrer("https://google.com/search?q=x"), "google");
});

test("R33: policies naye domain ka naam leti hain", () => {
  const privacy = read("apps/web/src/content/policies/privacy-policy.md");
  const terms = read("apps/web/src/content/policies/terms-and-conditions.md");
  assert.match(privacy, /designerclothing\.fashion/);
  assert.match(terms, /designerclothing\.fashion/);
  assert.doesNotMatch(privacy, /through likshaclothing\.com/);
});

test("R33: review URL order ke saath banta hai", () => {
  assert.equal(reviewUrl("LK-ABC123"), "/checkout?step=review&order=LK-ABC123");
});

test("R33: payment page par back-to-review link hai", () => {
  const pay = read("apps/web/src/app/orders/[orderNumber]/pay/page.tsx");
  assert.match(pay, /data-testid="back-to-review"/);
  assert.match(pay, /href=\{reviewUrl\(order\.orderNumber\)\}/);
});

test("R33: checkout order place par snapshot save karta hai (back ke liye)", () => {
  const form = read("apps/web/src/components/checkout-form.tsx");
  assert.match(form, /savePlacedOrder\(\{/);
  assert.match(form, /readPlacedOrder\(resumeOrderNumber\)/);
  assert.match(form, /data-testid="review-continue-payment"/);
  // resume mode me dobara order nahi banta
  assert.match(form, /if \(resumed\) \{\s*goToPlaced\(resumed\.orderNumber/);
  // browser back bhi review par aaye (R36: goToPayment me replaceState + pushState)
  assert.match(form, /window\.history\.replaceState\(\{\}, "", reviewUrl\(target\)\)/);
  assert.match(form, /data-testid="review-loading"/);
});

test("R33: checkout 3 step — delivery → review → confirmation (R46)", () => {
  const form = read("apps/web/src/components/checkout-form.tsx");
  const delivery = form.indexOf('label: "Delivery"');
  const review = form.indexOf('label: "Review"');
  const whatsapp = form.indexOf('label: "WhatsApp"');
  assert.ok(delivery > 0 && review > delivery && whatsapp > review, "step order delivery → review → whatsapp");
  // R36: payment step 3 checkout ke **andar** hai — alag page par redirect nahi
  assert.match(form, /placedUrl\(target\)/);
  assert.match(form, /data-testid="checkout-placed-step"/);
  assert.doesNotMatch(form, /\?pay=1/);
});

test("R33: snapshot sessionStorage me chalta hai (permanent nahi)", () => {
  const items = [{ title: "Suit", image: "/x.jpg", size: "M", quantity: 1, price: 599 }];
  const snapshot = {
    orderNumber: "LK-TEST01",
    total: 599,
    placedAt: new Date().toISOString(),
    items,
    customer: { name: "Asha", phone: "9876543210", email: "a@b.co", address: "1 Road", city: "Jaipur", state: "Rajasthan", pincode: "302001" },
  };
  const store = new Map<string, string>();
  const fakeWindow = {
    sessionStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  };
  const globals = globalThis as unknown as { window?: unknown };
  const previous = globals.window;
  globals.window = fakeWindow;
  try {
    savePlacedOrder(snapshot);
    assert.equal(readPlacedOrder("LK-TEST01")?.total, 599);
    assert.equal(readPlacedOrder("LK-OTHER"), null, "doosre order ka snapshot nahi milta");
    // 6 ghante purana snapshot expire
    assert.equal(readPlacedOrder("LK-TEST01", Date.now() + 7 * 60 * 60 * 1000), null);
    clearPlacedOrder();
    assert.equal(readPlacedOrder("LK-TEST01"), null);
  } finally {
    globals.window = previous;
  }
});

test("R33: sheet script ke demo images naye domain par hain", () => {
  const gs = read("scripts/google-apps-script/liksha-sheets.gs");
  assert.doesNotMatch(gs, /https:\/\/liksha-clothing\.vercel\.app\/images/);
  assert.match(gs, /https:\/\/designerclothing\.fashion\/images\/brand\/logo-desktop\.png/);
});

test("R33: admin login naye aur purane dono email leta hai", async () => {
  const previousEmail = process.env.ADMIN_EMAIL;
  delete process.env.ADMIN_EMAIL;
  try {
    const { checkCredentials } = await import("../../apps/admin/src/lib/auth");
    const password = process.env.ADMIN_PASSWORD ?? "liksha2026";
    assert.equal(checkCredentials("admin@designerclothing.fashion", password), true);
    assert.equal(checkCredentials("admin@likshaclothing.com", password), true);
    assert.equal(checkCredentials("someone@example.com", password), false);
  } finally {
    if (previousEmail !== undefined) process.env.ADMIN_EMAIL = previousEmail;
  }
});
