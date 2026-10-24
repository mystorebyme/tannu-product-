#!/usr/bin/env node
/**
 * Seed reviews generator.
 *
 * Problem: live store ke Trustoo reviews sirf ~129 products par hain — baaki
 * products par review section khali dikhta hai. Ye script un products ke liye
 * demo/sample reviews banati hai jinpar koi live review nahi hai.
 *
 * Rules (client ne maange):
 *  • koi duplicate review nahi (poori file me text unique),
 *  • insaan jaisa chhota text — 2 se 7 words, kabhi-kabhi ek lambi line,
 *  • overall positive (5★ zyada, 4★ kuch, 3★ bahut kam),
 *  • deterministic — same catalog par same output (build stable rehta hai).
 *
 * Output: database/seeds/reviews/seed-reviews.json
 *
 * NOTE: ye sample content hai. Real customers aane ke baad inhe hata kar asli
 * reviews (Trustoo sync ya apne verified orders) use karein.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const catalogPath = path.join(ROOT, "database/seeds/catalog.json");
const livePath = path.join(ROOT, "database/seeds/reviews/reviews.json");
const outPath = path.join(ROOT, "database/seeds/reviews/seed-reviews.json");

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const live = fs.existsSync(livePath)
  ? JSON.parse(fs.readFileSync(livePath, "utf8"))
  : { products: {} };

/** deterministic RNG (mulberry32) — handle se seed banata hai */
function rngFrom(text) {
  let seed = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    seed ^= text.charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const names = [
  "Priya", "Neha", "Anjali", "Ritika", "Pooja", "Sneha", "Aarti", "Kavita", "Meena", "Shalini",
  "Rupa", "Divya", "Swati", "Nidhi", "Payal", "Suman", "Rekha", "Sapna", "Varsha", "Jyoti",
  "Asha", "Bhavna", "Chhaya", "Deepa", "Ekta", "Farhana", "Garima", "Heena", "Isha", "Jaya",
  "Kiran", "Lata", "Madhu", "Nazia", "Pallavi", "Radhika", "Sadhana", "Tanya", "Uma", "Vidya",
  "Ritu", "Preeti", "Sarita", "Anita", "Manisha", "Kanchan", "Nisha", "Surbhi", "Trisha", "Yashika",
];
const initials = ["S", "K", "M", "R", "V", "A", "G", "P", "T", "B", "N", "J", "D", "L"];

const nounsByType = {
  anarkali: ["anarkali", "anarkali suit", "suit"],
  lehenga: ["lehenga", "lehenga choli", "outfit"],
  gown: ["gown", "dress", "outfit"],
  saree: ["saree", "drape"],
  sharara: ["sharara set", "sharara", "outfit"],
  kurta: ["kurta set", "kurta", "suit"],
  co: ["co-ord set", "co-ord", "set"],
  default: ["dress", "outfit", "piece"],
};

function nounsFor(product) {
  const type = `${product.productType ?? ""} ${product.title ?? ""}`.toLowerCase();
  if (type.includes("lehenga") || type.includes("lehnga")) return nounsByType.lehenga;
  if (type.includes("anarkali")) return nounsByType.anarkali;
  if (type.includes("gown")) return nounsByType.gown;
  if (type.includes("sharara")) return nounsByType.sharara;
  if (type.includes("kurta") || type.includes("suit")) return nounsByType.kurta;
  if (type.includes("saree")) return nounsByType.saree;
  if (type.includes("co-ord") || type.includes("coord")) return nounsByType.co;
  return nounsByType.default;
}

const openers = [
  "Loved this", "Really liked this", "Superb", "Beautiful", "Lovely", "Gorgeous", "Elegant",
  "Very nice", "Mind blowing", "Fantastic", "Perfect", "Worth every rupee", "So pretty",
];
const qualities = [
  "fabric quality", "stitching", "colour", "fit", "embroidery", "quality", "finishing",
  "material", "fall", "lace work", "print", "packaging",
];
const tails = [
  "true to size", "as shown in pictures", "highly recommended", "perfect for functions",
  "go for it", "value for money", "super comfortable", "looks premium", "everyone asked from where",
  "delivery was quick", "buying again", "no complaints", "absolutely stunning", "exceeded my expectations",
];
const shortNoTail = [
  "Loved it", "Beautiful piece", "Very comfortable", "Perfect fit", "Nice quality",
  "Superb stitching", "Elegant look", "Just wow", "Great value", "Really happy",
  "Fabric is soft", "Colour is beautiful", "Fits perfectly", "Lovely embroidery", "Good quality",
];
const longer = [
  "Wore this for my sister's engagement and got so many compliments",
  "Fabric is soft and the stitching is neat, better than expected",
  "Ordered a size up and it fits perfectly, colour exactly like the photos",
  "Bought this for a family function, everyone asked where it is from",
  "Quality is much better than local shops at this price",
  "Delivery came before time and packaging was very secure",
  "The embroidery looks rich and the fall of the fabric is beautiful",
  "Washes well, colour did not fade at all after two washes",
  "Comfortable enough to wear for the whole day, no itching anywhere",
  "Bought two colours because the first one was so good",
];

const used = new Set();
// live (Trustoo) reviews ke text se clash na ho
for (const block of Object.values(live.products ?? {})) {
  for (const review of block.reviews ?? []) used.add(normalize(review.body ?? ""));
}
function normalize(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function makeBody(random, product, attempt) {
  const noun = nounsFor(product)[Math.floor(random() * nounsFor(product).length)];
  const pick = (list) => list[Math.floor(random() * list.length)];
  const style = Math.floor(random() * 6);

  const candidates = [];
  if (style === 0) candidates.push(`${pick(openers)} ${noun}`);
  if (style === 1) candidates.push(`${pick(openers)} ${pick(qualities)}`);
  if (style === 2) candidates.push(`${pick(openers)} ${noun}, ${pick(tails)}`);
  if (style === 3) candidates.push(`${pick(shortNoTail)}`);
  if (style === 4) candidates.push(`${pick(qualities)} is ${pick(["great", "very good", "lovely", "genuine"])}, ${pick(tails)}`);
  if (style === 5) candidates.push(pick(longer));

  // attempt 2+ par suffix se variation — taaki duplicate na bane
  const base = candidates[0] ?? pick(shortNoTail);
  const finished = attempt === 0 ? base : `${base}, ${pick(tails)}`;
  return finished.charAt(0).toUpperCase() + finished.slice(1);
}

const products = catalog.products ?? [];
const seedProducts = {};
let total = 0;

for (const product of products) {
  if (live.products?.[product.handle]?.count) continue; // real reviews hain
  const random = rngFrom(product.handle);
  const count = 3 + Math.floor(random() * 3); // 3–5
  const reviews = [];

  for (let index = 0; index < count; index += 1) {
    let body = "";
    let attempt = 0;
    while (attempt < 40) {
      body = makeBody(random, product, attempt);
      if (!used.has(normalize(body))) break;
      attempt += 1;
    }
    if (used.has(normalize(body))) body = `${body} ${product.color ?? ""}`.trim();
    used.add(normalize(body));

    const ratingRoll = random();
    const rating = ratingRoll < 0.72 ? 5 : ratingRoll < 0.94 ? 4 : 3;
    const name = names[Math.floor(random() * names.length)];
    const initial = initials[Math.floor(random() * initials.length)];
    const daysAgo = 4 + Math.floor(random() * 300);
    const date = new Date(Date.UTC(2026, 9, 24) - daysAgo * 86_400_000).toISOString().slice(0, 10);

    reviews.push({
      id: `sd-${product.handle.slice(0, 12)}-${index + 1}`,
      author: `${name} ${initial}.`,
      rating,
      body,
      date,
      verified: true,
      photos: [],
      sample: true,
    });
  }

  const average = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
  seedProducts[product.handle] = {
    rating: Math.round(average * 10) / 10,
    count: reviews.length,
    reviews: reviews.sort((a, b) => (a.date < b.date ? 1 : -1)),
  };
  total += reviews.length;
}

fs.writeFileSync(
  outPath,
  `${JSON.stringify(
    {
      meta: {
        source: "seed",
        generatedAt: new Date().toISOString(),
        note:
          "Sample reviews — sirf un products ke liye jinke asli (Trustoo) reviews nahi hain. " +
          "Real customers aane par `scripts/reviews-sync/build-seed-reviews.mjs` ka output replace karein.",
      },
      products: seedProducts,
    },
    null,
    1,
  )}\n`,
);

console.log(
  `seed reviews: ${total} reviews / ${Object.keys(seedProducts).length} products ` +
    `(${products.length - Object.keys(seedProducts).length} products par live reviews already hain)`,
);
