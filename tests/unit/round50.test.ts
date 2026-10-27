import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { RAILS, railPool } from "../../apps/web/src/lib/rails.ts";

/**
 * R50 (owner):
 *  1. "trending … home page pr bi dikha do ok jo jo collection mahi" — home ka
 *     Trending rail ab SIRF Trending collection dikhata hai (wahi cards jo
 *     /collections/trending par hain — best-score picks ke saath).
 *  2. "noor … ye or ye aarushi … ek hi product hai inko merge kro ya ek ko
 *     remove kro jo treanding mai hai usko rhne dena dusre ko hta dena" —
 *     curated merge: Noor (trending) rehta hai, Aarushi usi family me fold
 *     (photos/reviews zinda; Noor ke card par family ka best score 4.8★/52).
 *  3. "aisi abhi or bi milenge unko bi fix kro … vapis se audit kr ke
 *     duplicated to htado ya merge kr do" — photo-fingerprint audit: dono
 *     stores par SAME photo files (>=2 shared) = same dress, naam chahe jo ho
 *     (Maharani↔Pnihari 9 photos, Adeena↔Black-Faux 8, Rang-E↔Rang-F fusion,
 *     Manyata↔Sanaya's, Keshvis 05↔td05 …).
 */

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const catalog = JSON.parse(read("database/seeds/catalog.json"));
const products: any[] = catalog.products;
const groups: Record<string, any> = catalog.colourGroups;
const byHandle = new Map(products.map((product) => [product.handle, product]));
const isListed = (product: any) =>
  !product.hidden && (!product.colourGroup || groups[product.colourGroup]?.handle === product.handle);
const familyOf = (handle: string) => byHandle.get(handle)?.colourGroup ?? null;

/* ---------- 1. home page par Trending collection ---------- */

test("R50: home Trending rail = Trending collection (jo collection me hai wahi home par)", () => {
  assert.deepEqual(RAILS.trendy.collections, ["trending"], "rail sirf trending collection se banta hai");
  assert.equal(RAILS.trendy.href, "/collections/trending");
  assert.match(RAILS.trendy.title, /Trending/i);

  const listedProducts = products.filter(isListed);
  const pool = railPool("trendy", listedProducts as never) as any[];
  const trendingCards = listedProducts.filter((product) => product.collections.includes("trending"));
  assert.equal(pool.length, trendingCards.length, "rail pool == /collections/trending cards");
  assert.ok(pool.some((product) => product.handle === "minisa-designer-embroidered-zari-sequins-work-gown"));
  assert.ok(pool.some((product) => product.handle === "rikva-premium-vichitra-royal-elegant-suit-set"));
  assert.ok(pool.some((product) => product.handle === "noor-festive-elegance-designer-suit-set"));

  const page = read("apps/web/src/app/page.tsx");
  assert.ok(page.includes('<ProductRail rail="trendy"'), "home page par trendy rail render hota hai");
});

/* ---------- 2. owner-pointed curated merge: Noor ↔ Aarushi ---------- */

test("R50: Noor ↔ Aarushi curated merge — trending wala rehta hai, dusra family me fold", () => {
  const overrides = JSON.parse(read("database/seeds/admin/overrides.json"));
  assert.deepEqual(overrides.mergeInto?.["noor-festive-elegance-designer-suit-set"], [
    "aarushi-heavy-pure-cinon-silk-gown",
  ]);

  const noor = byHandle.get("noor-festive-elegance-designer-suit-set");
  const aarushi = byHandle.get("aarushi-heavy-pure-cinon-silk-gown");
  assert.ok(noor && aarushi, "dono products catalog me hain (kuch delete nahi hua)");
  assert.ok(isListed(noor), "Noor ka card listed hai");
  assert.ok(noor.collections.includes("trending"), "Noor trending me rahe");
  assert.ok(!isListed(aarushi), "Aarushi ka alag card ab nahi");
  assert.ok(familyOf("aarushi-heavy-pure-cinon-silk-gown"), "Aarushi family me fold hua");
  assert.equal(familyOf("aarushi-heavy-pure-cinon-silk-gown"), familyOf("noor-festive-elegance-designer-suit-set"));

  const group = groups[familyOf("noor-festive-elegance-designer-suit-set")];
  assert.equal(group.handle, noor.handle, "family ka representative Noor — owner ka choice");
  assert.ok(group.key.startsWith("manual-"), "owner-curated family protected hai");

  // bufani-store ki same-dress copy bhi photo-fingerprint se usi family me judi
  const cinon = byHandle.get("heavy-pure-cinon-silk-gown-pent-dupatta-set-fully-stitched-ready-to-wear");
  assert.ok(cinon, "cinon copy catalog me hai");
  assert.equal(familyOf(cinon.handle), familyOf("noor-festive-elegance-designer-suit-set"));
  assert.ok(!isListed(cinon), "cinon copy ka alag card nahi");
  assert.ok(group.colours.length >= 3, "poori family swatches me");

  // family ka best score Noor ke card par — Aarushi ke 4.8★ / 52 reviews
  assert.equal(noor.rating, 4.8);
  assert.equal(noor.reviewCount, 52);
  assert.equal(aarushi.images.length >= 8, true, "Aarushi ki photos family me zinda hain");
});

/* ---------- 3. photo-fingerprint audit merges ---------- */

test("R50: same photos + alag naam = merge (photo-fingerprint audit)", () => {
  const families: Array<[string, string]> = [
    [
      "maharani-red-karva-chauth-special-anarkali-suit-set",
      "padmarani-red-special-anarkali-suit-set",
    ],
    [
      "adeena-black-faux-blooming-anarkali-style-sarara-suit-set-copy",
      "black-faux-blooming-anarkali-style-sarara-suit-set",
    ],
    [
      "azira-maroon-color-premium-anarkali-suit-set",
      "twinkle-maroon-silk-premium-anarkali-suit-set",
    ],
    [
      "yellow-trendy-anarkali-suit-set",
      "presenting-new-premium-quality-pure-romansilk-chanderi-fabric-fully-flare-anarkali-with-dupapta-set-pent-ready-to-wear",
    ],
    [
      "manyata-maroon-red-embroidered-georgette-suit-set",
      "sanayas-black-embroidered-georgette-suit-set",
    ],
    [
      "keshvis-orange-coloured-anarkali-suit-set-td05",
      "keshvis-orange-coloured-anarkali-suit-set-05",
    ],
  ];
  for (const [keep, dup] of families) {
    assert.ok(familyOf(keep), `${keep} family me hai`);
    assert.equal(familyOf(keep), familyOf(dup), `${keep} aur ${dup} ek family me`);
    const keeper = byHandle.get(keep);
    assert.equal(keeper.source, "liksha", `${keep}: card asli store ka`);
    assert.ok(isListed(keeper), `${keep} listed hai`);
    assert.ok(!isListed(byHandle.get(dup)), `${dup} ka alag card nahi`);
  }
});

test("R50: do bani hui groups same photos share karein → fuse (Rang-E ↔ Rang-F)", () => {
  const rangF = "rang-f-royale-blooming-lehenga-suit-set";
  const rangEExtra = "rang-e-royale-blooming-lehenga-suit-set-10511720087684";
  const rangELiksha = "rang-e-royale-blooming-lehenga-suit-set";
  assert.ok(familyOf(rangF), "rang-f family me");
  assert.equal(familyOf(rangF), familyOf(rangEExtra), "extra-store wali Rang-E group fuse hui");
  assert.equal(familyOf(rangF), familyOf(rangELiksha));
  const group = groups[familyOf(rangF)];
  const rep = byHandle.get(group.handle);
  assert.equal(rep.source, "liksha", "fuse ke baad card liksha ka");
  assert.ok(rep.rating >= 5 && rep.reviewCount >= 1, "family ka best score (5★) card par carry hua");
});

test("R50: conservative gates zinda — bina solid evidence merge nahi hota", () => {
  // Dharanis -12/-13: sirf handle paas-paas, photos/titles alag — do alag designs, do cards
  for (const handle of [
    "dharanis-wine-coloured-anarkali-suit-set-12",
    "dharanis-wine-coloured-anarkali-suit-set-13",
  ]) {
    const product = byHandle.get(handle);
    assert.ok(product, `${handle} catalog me hai`);
    assert.equal(product.colourGroup ?? null, null, `${handle} kisi family me nahi`);
    assert.ok(isListed(product), `${handle} listed hai`);
  }
  // ek photo share hona kaafi nahi (>=2 rule) — build source me threshold saaf hai
  const build = read("scripts/build-catalog.mjs");
  assert.ok(build.includes("shared >= 2"), "photo-fingerprint threshold >= 2 shared photos");
});

/* ---------- catalog integrity + build pipeline ---------- */

test("R50: catalog integrity — har member ka group zinda, rep member hai, counts sahi", () => {
  assert.equal(products.length, 448, "kuch delete nahi hua");
  assert.equal(products.filter(isListed).length, 345, "361 → 345 (16 duplicate cards gaye)");
  assert.equal(catalog.meta.listedProductCount, 345);
  assert.equal(catalog.meta.liveProductCount, 287, "liksha parity untouched");
  for (const product of products) {
    if (product.colourGroup) assert.ok(groups[product.colourGroup], `${product.handle} ka group missing`);
  }
  for (const group of Object.values(groups) as any[]) {
    assert.equal(byHandle.get(group.handle)?.colourGroup, group.key, `${group.key}: rep family me hai`);
    for (const colour of group.colours) {
      assert.ok(byHandle.get(colour.handle), `${colour.handle} catalog me missing`);
    }
    const handles = group.colours.map((colour: any) => colour.handle);
    assert.equal(new Set(handles).size, handles.length, `${group.key}: colours me duplicate nahi`);
  }
});

test("R50: build script me curated (mergeInto) + photo-fingerprint passes hain", () => {
  const build = read("scripts/build-catalog.mjs");
  assert.ok(build.includes("overrides.mergeInto"), "curated merges overrides se aate hain");
  assert.ok(build.includes("manual-"), "owner-curated family protected (manual- prefix)");
  assert.ok(build.includes("photo-fingerprint"), "image-fingerprint audit pass");
});
