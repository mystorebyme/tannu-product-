#!/usr/bin/env node
/**
 * Zero-dependency smoke test — build ke baad chalta hai.
 *   npm run build:web && npm run start --workspace @liksha/web &
 *   npm run test:smoke            (default http://localhost:3000)
 *   BASE_URL=https://likshaclothing.com npm run test:smoke
 *
 * Koi browser nahi chahiye — HTML/JSON par assertions. CI me Playwright se pehle yeh fast gate hai.
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

let passed = 0;
const failures = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function get(path) {
  const response = await fetch(`${BASE}${path}`, { redirect: "follow" });
  const text = await response.text();
  return { status: response.status, text, headers: response.headers };
}

async function main() {
  console.log(`smoke: ${BASE}\n`);

  const health = await get("/api/health");
  const healthBody = JSON.parse(health.text);
  check("health 200", health.status === 200, `status ${health.status}`);
  // 287 liksha products + extra store (guest) products daily sync se
  check(
    "health reports the live catalogue size",
    healthBody.data?.products >= 287,
    String(healthBody.data?.products),
  );

  const home = await get("/");
  check("home 200", home.status === 200, `status ${home.status}`);
  check("home lists products", /\/products\/[a-z0-9-]+/.test(home.text));
  check("home has brand name", /Liksha/i.test(home.text));
  check("home has support number", home.text.includes("9909790455"));
  check("home has the live announcement bar", /announcement-bar/.test(home.text));
  check(
    "home has no service-tile strip (removed on request)",
    !/100% SECURE PAYMENT/i.test(home.text) && !/7 DAYS REPLACEMENT/i.test(home.text),
  );
  check("home shows category counts from the live store", /ANARKALI SUIT/i.test(home.text) && /Products/i.test(home.text));

  const collection = await get("/collections/lehnga-choli");
  check("collection 200", collection.status === 200, `status ${collection.status}`);
  check("collection has products", /\/products\/[a-z0-9-]+/.test(collection.text));

  const catalog = JSON.parse(await (await fetch(`${BASE}/api/products?perPage=60&sort=price-low`)).text());
  const items = catalog.data ?? [];
  // order ke liye: multi-size product (size validation test karta hai)
  const product = items.find((item) => (item.sizes?.length ?? 0) > 1 && item.price <= 350_000) ?? items[0];
  // PDP gallery ke liye: jiski live gallery me kai images hain
  const galleryProduct = items.find((item) => (item.images?.length ?? 0) >= 3) ?? product;
  check("products api returns data", Boolean(product), JSON.stringify(catalog).slice(0, 120));

  if (product) {
    const pdp = await get(`/products/${galleryProduct.handle}`);
    check("PDP 200", pdp.status === 200, `status ${pdp.status}`);
    check("PDP shows price", pdp.text.includes("Rs."));
    check("PDP has add to cart", /Add to cart/i.test(pdp.text));
    check("PDP has size options", /\[3[4-9]\]|\[4[0-9]\]|Free Size/.test(pdp.text));
    const gallerySlides = (pdp.text.match(/gallery-slide/g) ?? []).length;
    check(
      "PDP renders a real gallery (multiple images)",
      gallerySlides >= 2,
      `${gallerySlides} slides for ${galleryProduct.handle} (${galleryProduct.images?.length ?? 0} images)`,
    );
    check("PDP shows the live description", /Product Details/i.test(pdp.text));
  }

  // ── phone OTP + GST invoice + tracking ──
  const otpStatus = JSON.parse(await (await fetch(`${BASE}/api/otp/status`)).text());
  check("otp status endpoint responds", typeof otpStatus.required === "boolean", JSON.stringify(otpStatus));

  let phoneToken;
  if (otpStatus.mode === "dev") {
    const start = await fetch(`${BASE}/api/otp/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: "9876543210" }),
    });
    const started = await start.json();
    check("dev OTP code issued", Boolean(started.devCode), JSON.stringify(started).slice(0, 120));
    const verified = await fetch(`${BASE}/api/otp/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: "9876543210", code: started.devCode }),
    });
    const verifiedBody = await verified.json();
    check("OTP verify issues a phone token", verified.status === 200 && Boolean(verifiedBody.phoneToken));
    phoneToken = verifiedBody.phoneToken;

    const wrong = await fetch(`${BASE}/api/otp/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: "9876543210", code: "000000" }),
    });
    check("wrong OTP is rejected", wrong.status === 401, `status ${wrong.status}`);
  }

  const search = JSON.parse(await (await fetch(`${BASE}/api/search?q=anarkali`)).text());
  const searchCount = search.results?.length ?? search.data?.length ?? 0;
  check("search returns hits", searchCount > 0, String(searchCount));

  const orderPayload = {
      customerName: "Smoke Test",
      email: "smoke@example.com",
      phone: "9876543210",
      address: "12 MI Road, Panch Batti",
      city: "Jaipur",
      state: "Rajasthan",
      pincode: "302001",
      paymentMethod: "prepaid",
    items: [{ handle: product?.handle, size: product?.sizes?.[1] ?? product?.sizes?.[0], quantity: 1 }],
  };

  if (otpStatus.required) {
    const blocked = await fetch(`${BASE}/api/orders`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": `smoke-blocked-${Date.now()}` },
      body: JSON.stringify({ ...orderPayload, phoneToken: undefined }),
    });
    check("order without verified phone is blocked", blocked.status === 400, `status ${blocked.status}`);
  }

  const order = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": `smoke-${Date.now()}` },
    body: JSON.stringify({ ...orderPayload, ...(phoneToken ? { phoneToken } : {}) }),
  });
  const orderBody = await order.json();
  check("order created", order.status === 201, `status ${order.status} ${JSON.stringify(orderBody).slice(0, 140)}`);

  if (orderBody.orderNumber) {
    const page = await get(`/orders/${orderBody.orderNumber}`);
    check("order page 200", page.status === 200, `status ${page.status}`);
    check("order page shows number", page.text.includes(orderBody.orderNumber));
    check("order page has a tracking timeline", page.text.includes('data-testid="order-tracking"'));
    check("order page links the GST invoice", page.text.includes(`/orders/${orderBody.orderNumber}/invoice`));

    const invoiceBlocked = await fetch(`${BASE}/api/orders/${orderBody.orderNumber}/invoice`);
    check("invoice needs phone verification", invoiceBlocked.status === 403, `status ${invoiceBlocked.status}`);

    const invoice = await fetch(`${BASE}/api/orders/${orderBody.orderNumber}/invoice?phone=3210`);
    const pdfBytes = new Uint8Array(await invoice.arrayBuffer());
    const pdfMagic = String.fromCharCode(...pdfBytes.slice(0, 5));
    check("GST invoice PDF downloads", invoice.status === 200 && pdfMagic === "%PDF-", `${invoice.status} ${pdfMagic}`);
    check("invoice PDF has content", pdfBytes.length > 1500, `${pdfBytes.length} bytes`);
  }

  const missing = await get("/orders/LK-NOTREAL1");
  check("unknown order gives 404 page", missing.status === 404, `status ${missing.status}`);

  const sitemap = await get("/sitemap.xml");
  check("sitemap 200", sitemap.status === 200, `status ${sitemap.status}`);
  check("sitemap has product urls", sitemap.text.includes("/products/"));

  console.log(`\nsmoke: ${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.error(failures.map((failure) => ` - ${failure}`).join("\n"));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("smoke crashed:", error);
  process.exit(1);
});
