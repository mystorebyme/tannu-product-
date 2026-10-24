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
import { imageUrl } from "@/lib/format";
import { siteConfig } from "@/config/site";
import { SafeImage } from "@/components/safe-image";

/** Home ke rails har 10 minute me badalte hain — page bhi utni hi der me refresh hota hai */
export const revalidate = 600;

export const metadata: Metadata = {
  title: "Liksha Clothing | Designer Anarkali Suits, Lehenga Choli & Suit Sets",
  description:
    "Shop designer Anarkali suits, lehanga choli and printed suit sets at Liksha Clothing. Hand-finished pieces, free shipping within India and express delivery on prepaid orders.",
  alternates: { canonical: "/" },
};

/** Live store ka home banner (same asset) */
const HERO_IMAGE =
  "https://www.likshaclothing.com/cdn/shop/files/Dussehra_Sale__Tradition_Meets_You.png?v=1792479831";
const HERO_HREF = "/products/ruby-royale-red-anarkali-suit-set";

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
    priceRange: "₹1,499 - ₹4,999",
  };

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── hero banner: live store jaisa full-bleed poster + slow ken-burns ── */}
      <section className="relative bg-[#f6ede2]">
        <Link href={HERO_HREF} className="group block overflow-hidden" aria-label="Shop the festive sale">
          <div className="relative aspect-[4/5] w-full overflow-hidden sm:aspect-[16/9] lg:aspect-[2.6/1]">
            <SafeImage
              src={imageUrl(HERO_IMAGE, 1600)}
              alt="Liksha Clothing festive sale — tradition meets you"
              loading="eager"
              fetchPriority="high"
              className="animate-kenburns h-full w-full object-cover object-center"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
            <span className="absolute inset-x-0 bottom-4 mx-auto w-max bg-white/90 px-6 py-2.5 text-[10.5px] font-semibold tracking-[.2em] text-[#862222] uppercase transition group-hover:bg-white sm:bottom-7">
              Shop the sale
            </span>
          </div>
        </Link>
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
