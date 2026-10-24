import Link from "next/link";
import type { Metadata } from "next";
import { ProductCarousel } from "@/components/product-carousel";
import { CategoryCircles } from "@/components/category-circles";
import { ReviewsStrip } from "@/components/reviews-strip";
import { EditorialBand, OccasionStrip } from "@/components/occasion-strip";
import { Reveal } from "@/components/reveal";
import { getProducts, getCollection } from "@/lib/store";
import { imageUrl } from "@/lib/format";
import { siteConfig } from "@/config/site";
import { SafeImage } from "@/components/safe-image";

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

  const trending = byCollection("trending");
  const newArrivals = [...byCollection("new-arrivals")].sort((a, b) =>
    String(b.publishedAt ?? "").localeCompare(String(a.publishedAt ?? "")),
  );

  // "Trendy Anarkali Sets" rail — live home jaisa 6 products (trending pehle, phir Liksha's choice)
  const trendyRail = [...trending, ...byCollection("likshas-choice").filter((p) => !trending.includes(p))].slice(0, 6);

  const anarkaliCollection = await getCollection("party-wear-gown");
  const lehngaCollection = await getCollection("lehnga-choli");
  const printedCollection = await getCollection("printed-suit-set");
  const newArrivalsCollection = await getCollection("new-arrivals");
  const saleCollection = await getCollection("sale");
  const choiceCollection = await getCollection("likshas-choice");

  // live home ka "LEHNGA CHOLI" rail
  const lehngaRail = byCollection("lehnga-choli").slice(0, 8);
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

      <ProductRail
        title="Trendy Anarkali Sets"
        subtitle="Top view in this week"
        href="/collections/trending"
        products={trendyRail}
      />

      <ProductRail
        title="New Arrivals"
        subtitle="Freshly dropped, straight from the studio"
        href="/collections/new-arrivals"
        products={newArrivals.slice(0, 8)}
      />

      {lehngaRail.length ? (
        <ProductRail
          title="Lehnga Choli"
          subtitle="Our range of designer lehnga choli"
          href="/collections/lehnga-choli"
          products={lehngaRail}
        />
      ) : null}

      <ReviewsStrip />
      <OccasionStrip />
      <EditorialBand />

    </div>
  );
}

function ProductRail({
  title,
  subtitle,
  href,
  products,
}: {
  title: string;
  subtitle: string;
  href: string;
  products: Awaited<ReturnType<typeof getProducts>>;
}) {
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
        <ProductCarousel products={products} perView={3} />
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
