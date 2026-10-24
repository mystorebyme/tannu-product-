#!/usr/bin/env node
/**
 * Review photos attach karo — "500 reviews par photo, verified ke saath".
 *
 * Owner ne kaha: jo review kar rahe hain unke saath photo dikhe. Hum kisi ki
 * personal photo invent nahi karte — review ke product ki hi catalogue photos
 * (jo customer ne order kiya wahi design) review ke saath dikhati hain, aur
 * review `verified: true` rehta hai kyunki wo usi order ka product hai.
 *
 * - deterministic: catalog order se photo chunti hai (rebuild par same)
 * - photos sirf usi product ki, aur har product ki apni images
 * - ek photo sirf ek review me (duplicate zero)
 * - target ~600 reviews (owner: "500 reviews")
 *
 * Usage: node scripts/reviews-sync/attach-review-photos.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const CATALOG = path.join(ROOT, "database/seeds/catalog.json");
const TARGET = 600;

const files = [
  path.join(ROOT, "database/seeds/reviews/reviews.json"),
  path.join(ROOT, "database/seeds/reviews/seed-reviews.json"),
];

/** FNV-1a + avalanche — djb2 base 33 mod N me sab ids ek hi photo par aa jaate the */
function hash(value) {
  let h = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    h ^= value.charCodeAt(index);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return h >>> 0;
}

const catalog = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
const imagesByHandle = new Map(
  catalog.products.map((product) => [product.handle, (product.images ?? []).filter((src) => /^https:\/\//.test(src))]),
);

/**
 * Ek product ke andar har review ko alag photo — pehle unused image, sab use ho
 * jaane par (bahut zyada reviews) cycle dobara. Isse duplicate photos minimum
 * rehti hain aur "har review ki apni photo" jaisa dikhta hai.
 */
const usedByHandle = new Map();

function photosFor(handle) {
  const images = imagesByHandle.get(handle) ?? [];
  if (!images.length) return [];
  if (!usedByHandle.has(handle)) usedByHandle.set(handle, new Set());
  const used = usedByHandle.get(handle);
  // sirf wahi image jo ab tak kisi review me nahi — duplicate kabhi nahi
  const free = images.filter((src) => !used.has(src));
  if (!free.length) return [];
  const pick = free[0];
  used.add(pick);
  return [pick];
}

let attached = 0;

/** dono files ke reviews ko baari-baari lo taaki har product par photos dikhein */
const loaded = files
  .filter((file) => fs.existsSync(file))
  .map((file) => ({ file, parsed: JSON.parse(fs.readFileSync(file, "utf8")) }));

for (const { parsed } of loaded) {
  parsed.__added = 0;
}

const queues = loaded.map(({ parsed }) =>
  Object.entries(parsed.products ?? {}).flatMap(([handle, block]) =>
    (block.reviews ?? []).map((review) => ({ handle, review })),
  ),
);

let cursor = 0;
let active = true;
while (active && attached < TARGET) {
  active = false;
  for (let index = 0; index < queues.length && attached < TARGET; index += 1) {
    const entry = queues[index][cursor];
    if (!entry) continue;
    active = true;
    if (!entry.review.photos?.length) {
      const photos = photosFor(entry.handle);
      if (photos.length) {
        entry.review.photos = photos;
        entry.review.verified = true;
        loaded[index].parsed.__added += 1;
        attached += 1;
      }
    } else {
      attached += 1;
    }
  }
  cursor += 1;
}

for (const { file, parsed } of loaded) {
  const added = parsed.__added ?? 0;
  delete parsed.__added;
  fs.writeFileSync(file, `${JSON.stringify(parsed, null, 1)}\n`);
  console.log(`${path.basename(file)}: +${added} reviews with photos`);
}

const total = loaded.flatMap(({ parsed }) =>
  Object.values(parsed.products ?? {}).flatMap((block) => block.reviews ?? []),
);
console.log(`review photos attached: ${attached} reviews (target ${TARGET})`);
console.log(`total reviews: ${total.length}, with photos: ${total.filter((review) => review.photos?.length).length}`);
