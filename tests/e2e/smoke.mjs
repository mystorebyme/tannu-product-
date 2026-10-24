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
  check("health reports 287 products", healthBody.data?.products === 287, String(healthBody.data?.products));

  const home = await get("/");
  check("home 200", home.status === 200, `status ${home.status}`);
  check("home lists products", /\/products\/[a-z0-9-]+/.test(home.text));
  check("home has brand name", /Liksha/i.test(home.text));
  check("home has support number", home.text.includes("9909790455"));

  const collection = await get("/collections/lehnga-choli");
  check("collection 200", collection.status === 200, `status ${collection.status}`);
  check("collection has products", /\/products\/[a-z0-9-]+/.test(collection.text));

  const catalog = JSON.parse(await (await fetch(`${BASE}/api/products?perPage=1`)).text());
  const product = catalog.data?.[0];
  check("products api returns data", Boolean(product), JSON.stringify(catalog).slice(0, 120));

  if (product) {
    const pdp = await get(`/products/${product.handle}`);
    check("PDP 200", pdp.status === 200, `status ${pdp.status}`);
    check("PDP shows price", pdp.text.includes("Rs."));
    check("PDP has add to cart", /Add to cart/i.test(pdp.text));
    check("PDP has size options", /\[3[4-9]\]|\[4[0-9]\]|Free Size/.test(pdp.text));
  }

  const search = JSON.parse(await (await fetch(`${BASE}/api/search?q=anarkali`)).text());
  const searchCount = search.results?.length ?? search.data?.length ?? 0;
  check("search returns hits", searchCount > 0, String(searchCount));

  const order = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": `smoke-${Date.now()}` },
    body: JSON.stringify({
      customerName: "Smoke Test",
      email: "smoke@example.com",
      phone: "9876543210",
      address: "12 MI Road, Panch Batti",
      city: "Jaipur",
      state: "Rajasthan",
      pincode: "302001",
      paymentMethod: "cod",
      items: [{ handle: product?.handle ?? "green-bandhej-maslin-anarkali-suit-set-td-141-copy", size: "S [36]", quantity: 1 }],
    }),
  });
  const orderBody = await order.json();
  check("order created", order.status === 201, `status ${order.status} ${JSON.stringify(orderBody).slice(0, 140)}`);

  if (orderBody.orderNumber) {
    const page = await get(`/orders/${orderBody.orderNumber}`);
    check("order page 200", page.status === 200, `status ${page.status}`);
    check("order page shows number", page.text.includes(orderBody.orderNumber));
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
