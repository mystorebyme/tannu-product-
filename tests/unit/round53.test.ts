import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * R53 (owner):
 *   1. "only knowing info he do every product mai" — Minisa gown jaisi gispich
 *      details (`&amp;`, run-on lines, "XXL (4" mid-word cut) har product par fix.
 *   2. "agr sheet mai number change kru to instant sabhi jgho pr number change ho
 *      jana chiye ok khi pr bi hard code nhai ho ye hai main baat" — WhatsApp
 *      number sirf sheet se; policies me bhi `{{WHATSAPP}}` placeholder.
 *   3. "jitna time lena chiye uss se khi guna jyada" — createOrder ke sheet reads
 *      parallel prefetch (sequential cold-start round-trips khatam).
 *   4. "according to dewali festaavil" — Diwali theme har page par (globals.css).
 *   5. "sirf useful/working files + document jinki help leni ho ki kise sheet work
 *      krti hai" — docs/google-sheets.md present, legacy deploy.yml gaya.
 */

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

/* ── 1. Product details quality — built catalog par hard assertions ────────── */

test("R53: catalog details clean — no glued tags/nbsp/double-escapes, word-boundary description", () => {
  const catalog = JSON.parse(read("database/seeds/catalog.json")) as {
    products: Array<{ handle: string; description?: string; descriptionHtml?: string }>;
  };
  assert.ok(catalog.products.length > 400, "catalog me products hain");

  const glued = /<\/(?:strong|em|b|i|u|span)>[A-Za-z0-9]/;
  for (const product of catalog.products) {
    const html = product.descriptionHtml ?? "";
    assert.ok(!glued.test(html), `${product.handle}: descriptionHtml me tag se chipka word`);
    assert.ok(!html.includes("&amp;amp;") && !html.includes("&amp;#"), `${product.handle}: double-escaped entity`);
    assert.ok(!html.includes("&nbsp;") && !html.includes("\u00a0"), `${product.handle}: nbsp bacha hai`);
    assert.ok(!/<h[3-5]><br><\/h[3-5]>/.test(html), `${product.handle}: khaali heading`);
    const description = product.description ?? "";
    assert.ok(description.length <= 400, `${product.handle}: description 400 se lambi`);
    // Purana bug: raw ".slice(0, 400)" se description bina ellipsis ke adhoore
    // word par kat ti thi ("XXL (4"). tidyDescription hamesha word boundary par
    // kaat kar "…" lagata hai — isliye exact 400-par-katam (bina …) ban hi nahi
    // sakti, aur "…" se pehle khula bracket/adhoora fragment nahi aata.
    if (description.length === 400) {
      assert.ok(description.endsWith("\u2026"), `${product.handle}: raw 400-char slice bacha hai`);
    }
    if (description.endsWith("\u2026")) {
      assert.ok(!/[\s(\[]\u2026$/.test(description), `${product.handle}: … se pehle adhoora fragment`);
    }
  }
});

test("R53: Minisa gown (owner ka example) — spaces, lining, sizes readable", () => {
  const catalog = JSON.parse(read("database/seeds/catalog.json")) as {
    products: Array<{ handle: string; description?: string; descriptionHtml?: string }>;
  };
  const minisa = catalog.products.find((p) => p.handle.startsWith("minisa"));
  assert.ok(minisa, "minisa product catalog me hai");
  const html = minisa.descriptionHtml ?? "";
  assert.match(html, /<\/strong>\s+[A-Z]/, "heading ke baad space");
  assert.match(html, /Comfortable <em>Cotton<\/em> lining/i, "run-on 'Comfortable<em>Cotton' fix");
  assert.match(minisa.description ?? "", /XXL\u2026$/, "sizes 'XXL…' par word-boundary cut");
});

test("R53: build-catalog.mjs me sanitize + tidyDescription logic present", () => {
  const script = read("scripts/build-catalog.mjs");
  assert.match(script, /function tidyDescription\(/, "tidyDescription helper");
  assert.match(script, /description: tidyDescription\(/, "main products path tidyDescription use karta hai");
  assert.match(script, /description: tidyDescription\(description\)/, "newProducts path bhi");
  assert.ok(!script.includes("stripEmoji(details.join(\" \").trim() || cleanTitle).slice(0, 400)"), "purana mid-word slice gaya");
  // sanitizeHtml normalization: nbsp, inline-tag spaces, empty headings, double-escapes
  assert.ok(script.includes("replace(/&nbsp;/gi"), "nbsp normalization");
  assert.ok(script.includes("(h[3-5])"), "empty-heading cleanup");
  assert.ok(script.includes("&amp;(amp|lt|gt|quot|#39);"), "double-escape decode");
  assert.ok(script.includes("(<(?:strong|em|b|i|u|span)"), "inline-tag spacing");
});

/* ── 2. WhatsApp number — kahin hardcode nahi, sheet se instant ────────────── */

test("R53: policies me number ki jagah {{WHATSAPP}} placeholder (source + generated)", () => {
  const policyDir = "apps/web/src/content/policies";
  let placeholders = 0;
  for (const file of fs.readdirSync(path.join(root, policyDir))) {
    if (!file.endsWith(".md")) continue;
    const text = read(`${policyDir}/${file}`);
    assert.ok(!text.includes("8005900581"), `${file}: hardcoded number`);
    placeholders += (text.match(/\{\{WHATSAPP\}\}/g) ?? []).length;
  }
  assert.ok(placeholders >= 5, "privacy/refund/terms me placeholders");

  const generated = read("apps/web/src/content/policies.generated.ts");
  assert.ok(!generated.includes("8005900581"), "generated bundle me hardcoded number");
  assert.match(generated, /\{\{WHATSAPP\}\}/, "generated bundle me placeholder");
  // R46: customer-facing policy text strictly Indian English — Hinglish line fix
  assert.ok(!generated.includes("par order number bhejiye"), "terms ki Hinglish line English me");
});

test("R53: PolicyBody client component number sheet se bharta hai", () => {
  const body = read("apps/web/src/components/policy-body.tsx");
  assert.match(body, /^"use client";/, "client component");
  assert.match(body, /useStoreSettings/, "settings (sheet) se number");
  assert.match(body, /whatsappNumber\(whatsapp\)/, "normalized number");
  assert.ok(body.includes("\\{\\{WHATSAPP\\}\\}"), "placeholder substitution regex");
  assert.ok(body.includes("markdown.replace("), "markdown par replace");
  assert.match(body, /renderMarkdown\(text\)/, "markdown render");
  // number khali ho to adhoori "WhatsApp:" line hat jaati hai (R45)
  assert.match(body, /WhatsApp:\[\s\\t\]\*\$|\[\s\\t\]\*WhatsApp:/, "empty-number line cleanup");

  const page = read("apps/web/src/app/policies/[slug]/page.tsx");
  assert.match(page, /<PolicyBody markdown=\{content\} \/>/, "policies page PolicyBody use karta hai");
  assert.ok(!page.includes("renderMarkdown(content)"), "server-render number-less article gaya");
});

test("R53: PDP + header copy me khali-number par blank nahi dikhta", () => {
  const pdp = read("apps/web/src/components/product-detail.tsx");
  assert.match(pdp, /on WhatsApp\{whatsapp \? ` \$\{whatsapp\}` : ""\} with your order number/, "return copy conditional");
  assert.match(pdp, /whatsapp \? `WhatsApp \$\{whatsapp\} for` : "message us on WhatsApp about"/, "sold-out copy conditional");
  const header = read("apps/web/src/components/site-header.tsx");
  assert.match(header, /whatsappNumber\(whatsapp\) \? \(\s*<p className="font-medium text-\[#862222\]">WhatsApp \{whatsapp\}<\/p>/, "mobile drawer guard");
});

/* ── 3. Speed — createOrder parallel prefetch ───────────────────────────────── */

test("R53: createOrder sheet reads parallel prefetch (sequential round-trips gaya)", () => {
  const orders = read("apps/web/src/lib/orders.ts");
  // prefetch block createOrder ke shuru me — sab reads ek saath start
  assert.match(orders, /const pincodeRead = payload\.skipPincodeCheck \? null : checkPincode\(payload\.pincode\);/, "pincode prefetch");
  assert.match(orders, /const productsRead = allProducts\(\);/, "products prefetch");
  assert.match(orders, /const readyRead = ordersBackend\(\) === "sheet" \? sheetOrdersReady\(\) : null;/, "ready prefetch");
  assert.match(orders, /if \(payload\.couponCode\) void readCoupons\(\)\.catch\(\(\) => null\);/, "coupons warm-up (in-flight dedupe se checkCouponCode ko yahi promise milta hai)");
  // await points wahi sequential checks par — error precedence same
  assert.match(orders, /const serviceability = await pincodeRead;/, "pincode await checkpoint");
  assert.match(orders, /const products = await productsRead;/, "products await");
  assert.match(orders, /const ready = await \(readyRead \?\? sheetOrdersReady\(\)\);/, "ready await (fallback cached call)");
  // unhandled-rejection safety guards (couponsRead ka catch inline hai)
  const guards = orders.match(/\.catch\(\(\) => undefined\)/g) ?? [];
  assert.ok(guards.length >= 3, "prefetch promises par side-guards");
  // purane sequential calls createOrder me nahi bachne chahiye
  assert.ok(!orders.includes("const products = await allProducts();"), "sequential products read gaya");
  assert.ok(!orders.includes("const ready = await sheetOrdersReady();"), "sequential ready read gaya");
});

/* ── 4. Diwali festive theme — har page (globals.css) ───────────────────────── */

test("R53: Diwali theme globals.css me — warm base, diya glow, gold ribbon, sparkles", () => {
  const css = read("apps/web/src/app/globals.css");
  assert.match(css, /background: #fffaf2;/, "warm ivory base (body)");
  assert.match(css, /body::before \{/, "fixed festive glow layer");
  assert.match(css, /radial-gradient\(900px 420px at 88% -6%, rgba\(201, 152, 62/, "gold diya glow");
  assert.match(css, /z-index: -1;/, "glow content ke peeche (zero layout shift)");
  assert.match(css, /body::after \{/, "top festive ribbon");
  assert.match(css, /linear-gradient\(90deg, #862222, #c9983e 28%, #eed28a 50%, #c9983e 72%, #862222\)/, "maroon→gold ribbon");
  assert.match(css, /h2\.font-display::before/, "heading sparkles (pseudo — DOM text safe)");
  assert.match(css, /content: "✦";/, "gold sparkle glyph");
  assert.match(css, /footer::before \{/, "footer gold shimmer");
  assert.match(css, /a\[class\*="bg-\[#862222\]"\]:hover/, "primary CTA festive hover glow");
  assert.match(css, /pointer-events: none;/, "decorative layer clicks block nahi karta");
});

/* ── 5. Repo hygiene — docs present, legacy workflow gaya ──────────────────── */

test("R53: sheet documentation present + legacy deploy.yml deleted", () => {
  const doc = read("docs/google-sheets.md");
  assert.match(doc, /Settings/, "Settings tab documented");
  assert.match(doc, /Products/, "Products tab documented");
  assert.match(doc, /whatsapp/, "WhatsApp number row documented");
  assert.match(doc, /\{\{WHATSAPP\}\}/, "placeholder explained");
  assert.match(doc, /set_token/, "token setup step");
  assert.match(doc, /New version/, "new-version deploy warning");
  assert.match(doc, /r46-1/, "current script version");
  assert.match(doc, /action=health/, "health check");

  assert.ok(!fs.existsSync(path.join(root, ".github/workflows/deploy.yml")), "legacy red deploy.yml gaya");
  // baaki working workflows intact
  for (const kept of ["ci.yml", "pages.yml", "catalog-sync.yml", "reviews-sync.yml", "keep-warm.yml", "live-audit.yml", "live-payments.yml", "cloudflare-worker.yml"]) {
    assert.ok(fs.existsSync(path.join(root, ".github/workflows", kept)), `${kept} rehna chahiye`);
  }
});
