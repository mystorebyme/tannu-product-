import Link from "next/link";
import type { Metadata } from "next";
import { RotatingRail } from "@/components/rotating-rail";
import { CategoryCircles } from "@/components/category-circles";
import { ReviewsStrip } from "@/components/reviews-strip";
import { EditorialBand, OccasionStrip } from "@/components/occasion-strip";
import { Reveal } from "@/components/reveal";
import { getProducts, getCollection } from "@/lib/store";
import { RAILS, type RailKey, railPool } from "@/lib/rails";
import { compactProduct, rotatePick, rotationBucket } from "@/lib/rotation";
import { assetUrl, imageUrl } from "@/lib/format";
import { siteConfig } from "@/config/site";
import { SafeImage } from "@/components/safe-image";

/** Home ke rails har 10 minute me badalte hain — page bhi utni hi der me refresh hota hai */
export const revalidate = 600;

export const metadata: Metadata = {
  title: "Designer Clothes | Designer Anarkali Suits, Lehenga Choli & Suit Sets",
  description:
    "Shop designer Anarkali suits, lehanga choli and printed suit sets at Designer Clothes. Hand-finished pieces, free shipping within India and express delivery on prepaid orders.",
  alternates: { canonical: "/" },
};

/**
 * Festive home banner — owner ka diya hua Diwali Sale poster (Flat 70% OFF).
 * Local asset hai (public/images), isliye GitHub Pages ke base path ke saath aata hai.
 */
const HERO_IMAGE = assetUrl("/images/diwali-sale-70.webp");
const HERO_HREF = "/collections/sale";

export default async function HomePage() {
  const products = await getProducts();
  const byCollection = (handle: string) => products.filter((product) => product.collections.includes(handle));

  /**
   * Har rail ka set 10-minute window se banta hai (server par bhi wahi algorithm
   * jo client par hai) — refresh par naye products, aur client bhi 10 min me
   * khud badal jaata hai.
   */
  const bucket = rotationBucket();
  const rail = (key: RailKey) => {
    const pool = railPool(key, products);
    const picks = rotatePick(pool, `${key}:${bucket}`, RAILS[key].count);
    return {
      initial: picks.map(compactProduct),
      // fallback pool (static preview ke liye) — chhota rakha hai
      pool: rotatePick(pool, `pool:${bucket}`, 24).map(compactProduct),
    };
  };
  const trendy = rail("trendy");
  const newArrivalsRail = rail("newArrivals");
  const lehnga = rail("lehnga");
  const explore = rail("explore");

  const anarkaliCollection = await getCollection("party-wear-gown");
  const lehngaCollection = await getCollection("lehnga-choli");
  const printedCollection = await getCollection("printed-suit-set");
  const newArrivalsCollection = await getCollection("new-arrivals");
  const saleCollection = await getCollection("sale");
  const choiceCollection = await getCollection("likshas-choice");

  // "Shop by edit" circles — ek line me, live store ka style
  const circleItems = [
    { href: "/collections/party-wear-gown", title: "Anarkali Suit", image: anarkaliCollection?.image, count: byCollection("party-wear-gown").length },
    { href: "/collections/lehnga-choli", title: "Lehnga Choli", image: lehngaCollection?.image, count: byCollection("lehnga-choli").length },
    { href: "/collections/printed-suit-set", title: "Printed Suit Set", image: printedCollection?.image, count: byCollection("printed-suit-set").length },
    { href: "/collections/new-arrivals", title: "New Arrivals", image: newArrivalsCollection?.image, count: byCollection("new-arrivals").length },
    { href: "/collections/likshas-choice", title: "Liksha's Choice", image: choiceCollection?.image, count: byCollection("likshas-choice").length },
    { href: "/collections/sale", title: "Sale", image: saleCollection?.image, count: byCollection("sale").length },
    { href: "/collections/weddin-collection", title: "Wedding", image: undefined, count: byCollection("weddin-collection").length },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: siteConfig.name,
    url: siteConfig.url,
    image: siteConfig.ogImage,
    description: siteConfig.description,
    telephone: siteConfig.phone,
    email: siteConfig.email,
    address: { "@type": "PostalAddress", addressLocality: "Jaipur", addressRegion: "Rajasthan", addressCountry: "IN" },
    priceRange: "₹499 - ₹699",
  };

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── hero banner: owner ka festive poster (mobile par poora, desktop par side-by-side) ── */}
      <section className="relative overflow-hidden bg-[#f7ecdd]" data-testid="hero-banner">
        <div className="mx-auto grid max-w-[1500px] items-stretch lg:grid-cols-[0.92fr_1.08fr]">
          <Link
            href={HERO_HREF}
            className="group relative order-1 block lg:order-2"
            aria-label="Shop the Diwali sale — flat 70% off"
          >
            <div className="relative flex h-full items-center justify-center overflow-hidden">
              <SafeImage
                src={HERO_IMAGE}
                alt="Designer Clothes Diwali Sale — flat 70% off ethnic wear"
                loading="eager"
                fetchPriority="high"
                className="mx-auto h-auto w-full max-w-[560px] object-contain transition duration-700 group-hover:scale-[1.01] lg:h-full lg:max-h-[78vh] lg:max-w-none"
              />
            </div>
          </Link>

          <div className="order-2 flex flex-col items-center justify-center gap-4 px-6 py-8 text-center lg:order-1 lg:items-start lg:px-12 lg:py-14 lg:text-left xl:px-16">
            <p className="text-[10px] font-semibold tracking-[.34em] text-[#9a5b3c] uppercase sm:text-[11px]">
              Diwali Sale
            </p>
            <h1 className="font-display text-[34px] leading-[1.05] font-medium text-[#5c1010] sm:text-[44px] lg:text-[54px]">
              Flat <span className="text-[#862222]">70%</span> Off
            </h1>
            <div className="mt-1 flex w-full max-w-[420px] flex-col gap-2.5 sm:flex-row sm:justify-center lg:justify-start">
              <Link
                href="/collections/sale"
                className="inline-flex h-11 items-center justify-center bg-[#862222] px-7 text-[11px] font-semibold tracking-[.16em] text-white uppercase transition hover:bg-[#6d1b1b]"
              >
                Shop the sale
              </Link>
              <Link
                href="/collections/new-arrivals"
                className="inline-flex h-11 items-center justify-center border border-[#862222] px-7 text-[11px] font-semibold tracking-[.16em] text-[#862222] uppercase transition hover:bg-[#862222] hover:text-white"
              >
                New arrivals
              </Link>
            </div>
            <ul className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-[#7b6f64] lg:justify-start">
              <li>Free shipping pan-India</li>
              <li aria-hidden>·</li>
              <li>Prepaid only</li>
              <li aria-hidden>·</li>
              <li>4–7 day delivery</li>
            </ul>
          </div>
        </div>
      </section>

      <CategoryCircles items={circleItems} />

      <ProductRail rail="trendy" products={trendy.initial} pool={trendy.pool} />

      <ProductRail rail="newArrivals" products={newArrivalsRail.initial} pool={newArrivalsRail.pool} />

      <ProductRail rail="lehnga" products={lehnga.initial} pool={lehnga.pool} />

      <ReviewsStrip />

      <ProductRail rail="explore" products={explore.initial} pool={explore.pool} />
      <OccasionStrip />
      <EditorialBand />

    </div>
  );
}

function ProductRail({
  rail,
  products,
  pool,
}: {
  rail: RailKey;
  products: Awaited<ReturnType<typeof getProducts>>;
  pool: Awaited<ReturnType<typeof getProducts>>;
}) {
  const { title, subtitle, href } = RAILS[rail];
  if (!products.length) return null;
  return (
    <section className="container-liksha py-10 lg:py-14">
      <Reveal className="flex flex-col items-center">
        <h2 className="font-display text-[26px] leading-tight font-medium tracking-[.03em] text-[#2f2a25] sm:text-[32px]">
          {title}
        </h2>
        <p className="mt-1 text-[11.5px] tracking-[.14em] text-[#9c8f82] uppercase">{subtitle}</p>
      </Reveal>
      <Reveal className="mt-7" delay={80}>
        <RotatingRail rail={rail} initial={products} pool={pool} perView={3} />
      </Reveal>
      <div className="mt-8 flex justify-center">
        <Link
          href={href}
          className="border border-[#862222] px-9 py-3 text-[11px] font-semibold tracking-[.18em] text-[#862222] uppercase transition hover:bg-[#862222] hover:text-white"
        >
          View All
        </Link>
      </div>
    </section>
  );
}
