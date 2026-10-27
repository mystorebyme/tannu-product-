import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * R49 (owner):
 *  1. PDP hover-zoom fix — "cursor jata hai image pr to zoom honi chiye … but jo
 *     main image ke background mai hota hai isko fix kro or cursor ke hte hai
 *     vapis vais ki vasi ho jani chiye".
 *     Root cause: zoom layer bina z-index ka background-image div tha — current
 *     slide (z-10) ke PEECHE render hota tha, isliye zoom sirf image ke aas-paas
 *     ki khaali background par ulta dikhta tha; transition transform par thi jabki
 *     change opacity hoti thi (mouse leave par jhatka). Ab: slide ke oopar (z-20)
 *     wahi object-contain image, cursor-origin se scale(1.9), aur leave par
 *     transform+opacity transition se smooth wapsi.
 *  2. Site-wide smoothing — silkier transition easing, soft image fade, brand
 *     selection/focus colours, warm desktop scrollbar, phototourl preconnect.
 *  3. Duplicate merge — "ek hi dress mai alag images ke sath duplicate product
 *     hai jo alag nam se list hai unko bi merge kr dena".
 *  4. Trending hype — "quality vest score wala" 2 items (5★, sabse zyada reviews).
 */

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

const catalog = JSON.parse(read("database/seeds/catalog.json"));
const products: any[] = catalog.products;
const groups: Record<string, any> = catalog.colourGroups;
const byHandle = new Map(products.map((product) => [product.handle, product]));
const isListed = (product: any) =>
  !product.hidden && (!product.colourGroup || groups[product.colourGroup]?.handle === product.handle);
const listed = products.filter(isListed);

/* ---------------- 1. PDP hover-zoom fix ---------------- */

test("R49: zoom layer main image ke OOPAR hai (z-20) — background wala bug gaya", () => {
  const gallery = read("apps/web/src/components/product-gallery.tsx");
  // purana broken background-image zoom layer ab hai hi nahi
  assert.ok(!gallery.includes("backgroundImage"), "background-image zoom layer hatna chahiye");
  assert.ok(!gallery.includes("backgroundSize"), "backgroundSize zoom layer hatna chahiye");
  // naya layer: slide (z-10) ke oopar, wahi object-contain image
  assert.match(
    gallery,
    /pointer-events-none absolute inset-0 z-20 hidden overflow-hidden sm:block/,
    "zoom layer slide ke oopar (z-20) hona chahiye",
  );
  const zoomLayer = gallery.slice(gallery.indexOf("R49 hover-zoom layer"));
  assert.ok(zoomLayer.includes('className="h-full w-full object-contain"'), "zoom image object-contain se match kare");
  assert.ok(zoomLayer.includes('src={zoomSrc}'), "zoom layer apna retained src use kare");
});

test("R49: zoom cursor ke point se hota hai aur leave par smooth 'vaise ki vaise' wapsi", () => {
  const gallery = read("apps/web/src/components/product-gallery.tsx");
  assert.ok(gallery.includes('transform: zoom ? "scale(1.9)" : "scale(1)"'), "scale zoom/rest states");
  assert.ok(gallery.includes("transformOrigin: origin"), "zoom cursor origin se anchor ho");
  assert.ok(
    gallery.includes('transition: "transform 340ms cubic-bezier(0.22, 1, 0.36, 1)"'),
    "scale-down transition smooth hona chahiye",
  );
  assert.ok(gallery.includes('transition: "opacity 240ms ease"'), "opacity fade transition");
  // mouse leave par origin reset NAHI — fade-out usi point se smooth wapas hota hai
  const leaveHandler = gallery.slice(gallery.indexOf("onMouseLeave"));
  assert.ok(!leaveHandler.slice(0, 400).includes("setOrigin"), "leave par origin jhatke se reset na ho");
  const enterHandler = gallery.slice(gallery.indexOf("onMouseEnter"));
  assert.ok(
    enterHandler.slice(0, 300).includes("originFrom(event.clientX, event.clientY)"),
    "enter par zoom cursor point se shuru ho",
  );
  // purani leave-reset line gayi — origin sirf cursor position se set hota hai
  assert.equal(gallery.match(/setOrigin\("50% 50%"\)/g)?.length ?? 0, 0, "koi hard reset nahi");
  assert.ok(gallery.includes('useState("50% 50%")'), "initial origin center");
});

test("R49: zoom instant hai — 1400px preload + src fade-out tak retain", () => {
  const gallery = read("apps/web/src/components/product-gallery.tsx");
  assert.ok(gallery.includes("useState<string | null>(null)"), "zoomSrc state");
  assert.ok(gallery.includes("if (!zoom) return;"), "zoomSrc sirf zoom par set, leave par retain");
  const preloads = gallery.match(/imageUrl\((?:src|gallery\[index\]), 1400\)/g) ?? [];
  assert.ok(preloads.length >= 2, "current image 1400 me preload + zoomSrc set");
});

/* ---------------- 2. site-wide smoothing + speed ---------------- */

test("R49: globals.css — silky transitions, brand selection/focus, warm scrollbar, soft fade", () => {
  const css = read("apps/web/src/app/globals.css");
  assert.ok(css.includes("transition-duration: 220ms"), "Tailwind transitions thode lambe");
  const easingBlock = css.slice(css.indexOf("R49 smoothing"));
  assert.ok(easingBlock.includes("cubic-bezier(0.22, 1, 0.36, 1)"), "silky easing");
  assert.ok(css.includes(".img-fade"), "soft image fade class");
  assert.ok(css.includes("::selection"), "brand selection colour");
  assert.ok(css.includes(":focus-visible"), "keyboard focus ring");
  assert.ok(css.includes("::-webkit-scrollbar-thumb"), "warm desktop scrollbar");
  const reduced = css.slice(css.indexOf("prefers-reduced-motion"));
  assert.ok(reduced.includes(".img-fade"), "reduced motion par fade off");
  assert.ok(reduced.includes("transition-duration: 1ms"), "reduced motion par transitions off");
});

test("R49: SafeImage fade sirf lazy images par — hero/LCP fast rehta hai", () => {
  const safeImage = read("apps/web/src/components/safe-image.tsx");
  assert.ok(safeImage.includes('loading === "lazy" && !failed'), "fade sirf lazy + non-failed par");
  assert.ok(safeImage.includes("img-fade"), "img-fade class lagti hai");
});

test("R49: phototourl CDN preconnect — owner-uploaded photos jaldi load hon", () => {
  const layout = read("apps/web/src/app/layout.tsx");
  assert.ok(layout.includes('<link rel="preconnect" href="https://cdn.phototourl.com"'), "preconnect");
  assert.ok(layout.includes('<link rel="dns-prefetch" href="https://cdn.phototourl.com"'), "dns-prefetch fallback");
});

/* ---------------- 3. duplicate listings merge ---------------- */

const normalizeTitle = (title: string) =>
  String(title ?? "")
    .toLowerCase()
    .replace(/copy of/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((word) => word && !/^\d+$/.test(word))
    .join(" ");

test("R49: listing par koi do products same normalized title ke nahi (duplicates merged)", () => {
  const seen = new Map<string, string>();
  for (const product of listed) {
    const key = normalizeTitle(product.title);
    assert.ok(!seen.has(key), `${seen.get(key)} aur ${product.handle} ek jaise naam se listed hain (${key})`);
    seen.set(key, product.handle);
  }
  // merge ke baad listings 388 → 361; products/images parity untouched
  assert.equal(products.length, 448, "koi product delete nahi hua — sab groups me fold hue");
  assert.equal(listed.length, 361);
  assert.equal(catalog.meta.listedProductCount, 361);
  assert.equal(catalog.meta.liveProductCount, 287, "liksha parity untouched");
});

test("R49: owner wale duplicate pairs merge hue — card ek, swatches me poori family", () => {
  const mergedFamilies: Array<[string, number, number | null]> = [
    // [representative (liksha), min family size, expected rating carry (null = own)]
    ["rangshaa-heavy-embroidered-maxi-set", 3, null],
    ["purple-embroidered-anarkali-gown-set", 2, null],
    ["kunza-black-royal-anarkali-set", 2, null],
    ["sanika-noor-black-color-embroidered-work-anarkali-suit-set", 2, null],
    ["aviras-elegant-ivory-base-with-red-floral-detailing-anarkali-suit-set", 2, null],
    ["vlveera-white-heavy-silk-anarkali-gown-set-with-zari-sequins-work", 2, null],
    ["sunheri-fux-georgette-suit-set-6013", 2, 4.6],
    ["whispering-breeze-georgette-embroidered-suit-set-td-107", 2, 4.9],
    ["premium-ivory-royal-zari-work-kali-cut-anarkali-suit-set", 2, 4.8],
  ];
  for (const [handle, minSize, carriedRating] of mergedFamilies) {
    const rep = byHandle.get(handle);
    assert.ok(rep, `${handle} catalog me hai`);
    assert.equal(rep.source, "liksha", `${handle}: representative asli (liksha) store ka`);
    assert.ok(isListed(rep), `${handle}: ek card listed hai`);
    assert.ok(rep.colourGroup, `${handle}: family group me hai`);
    const group = groups[rep.colourGroup];
    assert.equal(group.handle, handle, `${handle}: group ka representative hai`);
    assert.ok(group.colours.length >= minSize, `${handle}: family me >= ${minSize} members`);
    // baaki members listed nahi — duplicate cards gaye
    for (const colour of group.colours) {
      if (colour.handle === handle) continue;
      const member = byHandle.get(colour.handle);
      assert.ok(member, `${colour.handle} catalog me hai (delete nahi hua)`);
      assert.ok(!isListed(member), `${colour.handle} ab alag card nahi`);
    }
    // same dress ke reviews representative par carry (sirf upward)
    if (carriedRating !== null) {
      assert.equal(rep.rating, carriedRating, `${handle}: family ka best score card par`);
      assert.ok(rep.reviewCount > 0, `${handle}: reviewCount carry hua`);
    }
    // family ki har photo swatches me zinda hai (images products par rehte hain)
    const familyImages = group.colours.reduce((sum: number, colour: any) => sum + (colour.images?.length ?? 0), 0);
    assert.ok(familyImages >= group.colours.length, `${handle}: family photos preserved`);
  }
});

test("R49: handle-base family joins — bacha-kucha duplicate listing group me juda", () => {
  // crop-top family: -4/-6 alag cards the, ab bani hui group ke swatches hain
  for (const handle of [
    "premium-quality-heavy-traditional-crop-top-with-shrug-4",
    "premium-quality-heavy-traditional-crop-top-with-shrug-6",
    "premium-readymade-anarkali-suit-set-3-pis-184",
  ]) {
    const product = byHandle.get(handle);
    assert.ok(product, `${handle} catalog me hai`);
    assert.ok(product.colourGroup, `${handle} ab group me fold hua`);
    assert.ok(!isListed(product), `${handle} ab alag card nahi`);
  }
  // do bani hui groups kabhi fuse nahi hotin — dharanis -12/-13 alag designs, alag cards
  for (const handle of ["dharanis-wine-coloured-anarkali-suit-set-12", "dharanis-wine-coloured-anarkali-suit-set-13"]) {
    const product = byHandle.get(handle);
    assert.ok(product && !product.colourGroup, `${handle} apni jagah listed (conservative gate)`);
  }
});

/* ---------------- 4. trending hype — best score items ---------------- */

test("R49: Trending me 2 best-score items — Minisa (5★/30) aur Rikva (5★/27)", () => {
  const overrides = JSON.parse(read("database/seeds/admin/overrides.json"));
  for (const handle of [
    "minisa-designer-embroidered-zari-sequins-work-gown",
    "rikva-premium-vichitra-royal-elegant-suit-set",
  ]) {
    const patch = overrides.products?.[handle];
    assert.ok(patch?.collections?.includes("trending"), `${handle}: overrides me trending patch`);
    const product = byHandle.get(handle);
    assert.ok(product, `${handle} catalog me hai`);
    assert.ok(product.collections.includes("trending"), `${handle}: trending collection me`);
    assert.ok(isListed(product), `${handle}: listed hai`);
    assert.equal(product.rating, 5, `${handle}: 5★`);
    assert.ok(product.reviewCount >= 27, `${handle}: sabse zyada reviews wali family se`);
  }
  const trendingListed = listed.filter((product) => product.collections.includes("trending"));
  assert.equal(trendingListed.length, 7, "6 trending the — duplicate merge + 2 naye = 7 cards");
  const trendingCollection = catalog.collections.find((collection: any) => collection.handle === "trending");
  assert.equal(trendingCollection.productCount, 7);
});

/* ---------------- 5. parity infra — curation-aware ---------------- */

test("R49: verify + catalog test owner curation (overrides) ke saath parity-aware hain", () => {
  const verify = read("scripts/verify-catalog.mjs");
  assert.ok(verify.includes("overrideProducts"), "verify overrides padhta hai");
  assert.ok(verify.includes("expectedCounts"), "verify expected counts override delta se adjust karta hai");
  const catalogTest = read("tests/unit/catalog.test.ts");
  assert.ok(catalogTest.includes("overrideProducts"), "catalog.test bhi override-aware");
});
