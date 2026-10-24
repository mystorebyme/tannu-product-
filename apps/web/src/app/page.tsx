import Link from "next/link";
import type { Metadata } from "next";
import { ProductGrid } from "@/components/product-card";
import { EditorialBand, OccasionStrip } from "@/components/occasion-strip";
import { Reveal } from "@/components/reveal";
import { getProducts, getCollection, products as allProducts } from "@/lib/store";
import { imageUrl } from "@/lib/format";
import { siteConfig } from "@/config/site";
import { SafeImage } from "@/components/safe-image";

export const metadata: Metadata = {
  title: "Liksha Clothing | Designer Anarkali Suits, Lehenga Choli & Suit Sets",
  description:
    "Shop designer Anarkali suits, lehanga choli and printed suit sets at Liksha Clothing. Free shipping within India, COD under Rs. 3,500, express delivery on prepaid orders.",
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

      {/* ── category tiles: live store ke counts ── */}
      <section className="container-liksha pt-6 lg:pt-9">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-4">
          {[
            { href: "/collections/party-wear-gown", image: anarkaliCollection?.image, title: "ANARKALI SUIT", count: byCollection("party-wear-gown").length },
            { href: "/collections/lehnga-choli", image: lehngaCollection?.image, title: "LEHNGA CHOLI", count: byCollection("lehnga-choli").length },
            { href: "/collections/printed-suit-set", image: printedCollection?.image, title: "PRINTED SUIT SET", count: byCollection("printed-suit-set").length },
          ].map((tile, index) => (
            <Reveal key={tile.href} delay={index * 90}>
              <CategoryTile href={tile.href} image={imageUrl(tile.image, 800)} title={tile.title} count={`${tile.count} Products`} />
            </Reveal>
          ))}
        </div>
      </section>

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
        products={newArrivals.slice(0, 6)}
      />

      <OccasionStrip />
      <EditorialBand />

      <section className="container-liksha pb-14">
        <Reveal className="bg-[#862222] px-6 py-10 text-center text-[#f8ebdc] sm:px-10">
          <p className="text-[10.5px] tracking-[.28em] uppercase">Liksha Clothing</p>
          <h2 className="mt-2 font-display text-[26px] leading-tight font-medium text-white sm:text-[34px]">
            {allProducts.length} styles, one wardrobe
          </h2>
          <p className="mx-auto mt-2 max-w-[560px] text-[12.5px] leading-relaxed">
            Hand-finished Anarkali suits, lehengas and suit sets. Free shipping within India, express
            delivery on prepaid orders and COD under Rs. 3,500.
          </p>
          <Link
            href="/collections/new-arrivals"
            className="mt-5 inline-block bg-[#f8ebdc] px-8 py-3 text-[11px] font-semibold tracking-[.18em] text-[#862222] uppercase transition hover:bg-white"
          >
            Shop new arrivals
          </Link>
        </Reveal>
      </section>
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
        <ProductGrid products={products} columns={3} />
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

function CategoryTile({
  href,
  image,
  title,
  count,
}: {
  href: string;
  image: string;
  title: string;
  count: string;
}) {
  return (
    <Link href={href} className="group relative block overflow-hidden bg-[#f3ece4]">
      <div className="relative aspect-[4/5] w-full overflow-hidden">
        <SafeImage
          src={image}
          alt={title}
          sizes="(max-width: 640px) 100vw, 33vw"
          className="h-full w-full object-cover transition-transform duration-[900ms] group-hover:scale-[1.05]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 text-center sm:p-5">
          <h2 className="font-display text-xl font-medium tracking-[.08em] text-white uppercase drop-shadow sm:text-2xl">
            {title}
          </h2>
          <p className="mt-0.5 text-[10.5px] tracking-[.14em] text-white/85 uppercase">{count}</p>
        </div>
      </div>
    </Link>
  );
}
