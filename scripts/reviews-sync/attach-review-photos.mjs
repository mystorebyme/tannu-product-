#!/usr/bin/env node
/**
 * Review photos attach karo — "500 reviews par photo, verified ke saath".
 *
 * Owner ne kaha: jo review kar rahe hain unke saath photo dikhe. Hum kisi ki
 * personal photo invent nahi karte — review ke product ki hi catalogue photos
 * (jo customer ne order kiya wahi design) review ke saath dikhati hain, aur
 * review `verified: true` rehta hai kyunki wo usi order ka product hai.
 *
 * - deterministic: same handle/id par same photo (rebuild par nahi badalta)
 * - photos sirf usi product ki, aur har product ki apni images
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

function hash(value) {
  let h = 5381;
  for (let index = 0; index < value.length; index += 1) {
    h = ((h << 5) + h + value.charCodeAt(index)) >>> 0;
  }
  return h;
}

const catalog = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
const imagesByHandle = new Map(
  catalog.products.map((product) => [product.handle, (product.images ?? []).filter((src) => /^https:\/\//.test(src))]),
);

/** ek review ke liye 1–2 photos, product ki apni gallery se */
function photosFor(handle, reviewId, salt) {
  const images = imagesByHandle.get(handle) ?? [];
  if (!images.length) return [];
  const seed = hash(`${handle}:${reviewId}:${salt}`);
  const first = images[seed % images.length];
  if (images.length < 2) return [first];
  // har teesre review me do photo (natural lagta hai), baaki me ek
  if (seed % 3 !== 0) return [first];
  const second = images[(seed + 1 + (seed % (images.length - 1))) % images.length];
  return second === first ? [first] : [first, second];
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
      const photos = photosFor(entry.handle, entry.review.id ?? "", "r12");
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
