import Link from "next/link";
import { ProductGrid } from "@/components/product-card";
import { HomeSections } from "@/components/home-sections";
import { EditorialBand, OccasionStrip } from "@/components/occasion-strip";
import { getProducts } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const products = await getProducts();
  const anarkali = products.filter((p) => p.collections.includes("party-wear-gown")).slice(0, 6);
  const newArrivals = products.filter((p) => p.collections.includes("new-arrivals")).slice(0, 24);
  const lehnga = products.filter((p) => p.collections.includes("lehnga-choli")).slice(0, 20);

  return (
    <div>
      <div className="bg-[#f5efe8] py-2 text-center">
        <p className="px-3 text-[10.5px] font-medium tracking-[.1em] text-[#5c4a3d] uppercase sm:text-[11.5px]">
          ⚡⚡ Free Shipping Under 3500/- ⚡⚡ For Multiple items, Advance Payment Required ⚡⚡
        </p>
      </div>

      <section className="relative bg-[#f6ede2]">
        <Link href="/collections/party-wear-gown" className="hidden lg:block">
          <div className="relative mx-auto grid max-w-[1400px] grid-cols-[1.05fr_1fr] items-stretch">
            <div className="flex flex-col justify-center bg-[linear-gradient(120deg,#5c1414_0%,#862222_55%,#a63a2a_100%)] px-12 py-16 xl:px-16">
              <p className="text-[11px] tracking-[.32em] text-[#f3d9b8] uppercase">Liksha Clothing · Tradition meets you</p>
              <p className="mt-5 font-display text-[30px] tracking-[.22em] text-[#f7e5cd] uppercase">Happy</p>
              <h1 className="font-display text-[68px] leading-[0.95] font-semibold text-[#fdf3e6] xl:text-[82px]">
                Dussehra
              </h1>
              <p className="mt-1 font-display text-[30px] tracking-[.3em] text-[#f0c98e] uppercase">Sale</p>
              <p className="mt-5 max-w-[360px] text-[13px] leading-relaxed text-[#f6e6d6]">
                Celebrate the victory of good over evil with hand-embroidered anarkalis, lehengas and
                festive suit sets — flat 50% off for a limited time.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <span className="flex items-baseline gap-2 border border-[#e9c98f] px-4 py-2.5 text-[#fdf3e6]">
                  <span className="text-[10.5px] tracking-[.18em] uppercase">Flat</span>
                  <span className="font-display text-[26px] leading-none font-semibold">50%</span>
                  <span className="text-[10.5px] tracking-[.18em] uppercase">off</span>
                </span>
                <span className="bg-[#fdf3e6] px-6 py-3 text-[11px] font-semibold tracking-[.18em] text-[#862222] uppercase">
                  Shop the sale
                </span>
              </div>
              <p className="mt-5 text-[10.5px] tracking-[.16em] text-[#e8cfae] uppercase">
                Premium fabrics · Exquisite designs · Perfect for festive moments
              </p>
            </div>
            <div className="relative min-h-[520px] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/site/banner.jpg"
                alt="Dussehra Sale — festive anarkali and lehenga looks"
                className="absolute inset-0 h-full w-full object-cover object-[center_28%]"
                fetchPriority="high"
              />
            </div>
          </div>
        </Link>
        <Link href="/collections/party-wear-gown" className="block lg:hidden">
          <div className="relative mx-auto aspect-[3/4] w-full max-w-[768px] overflow-hidden bg-[#f3ece4]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/site/banner.jpg"
              alt="Dussehra Sale — Tradition meets you"
              className="h-full w-full object-cover object-top"
              fetchPriority="high"
            />
          </div>
        </Link>
      </section>
      <div className="overflow-hidden border-y border-[#e9dfd4] bg-[#862222] py-2">
        <div className="flex w-max animate-marquee gap-10 whitespace-nowrap">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex gap-10">
              {[
                "Flat 50% off Dussehra sale",
                "Free shipping across India",
                "7 days easy replacement",
                "COD available under Rs. 3,500",
                "Hand-finished designer ethnic wear",
              ].map((item) => (
                <span key={item} className="text-[10.5px] tracking-[.2em] text-[#f6e6d6] uppercase">
                  ✦ {item}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <section className="container-liksha pt-6 lg:pt-9">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-4">
          <CategoryTile
            href="/collections/party-wear-gown"
            image="/images/site/cat-anarkali.jpg"
            title="ANARKALI SUIT"
            count={`${products.filter((p) => p.collections.includes("party-wear-gown")).length} Products`}
            tall
          />
          <CategoryTile
            href="/collections/lehnga-choli"
            image="/images/site/cat-lehnga.webp"
            title="LEHNGA CHOLI"
            count={`${products.filter((p) => p.collections.includes("lehnga-choli")).length} Products`}
          />
          <CategoryTile
            href="/collections/printed-suit-set"
            image="/images/site/cat-printed.jpg"
            title="PRINTED SUIT SET"
            count={`${products.filter((p) => p.collections.includes("printed-suit-set")).length} Products`}
          />
        </div>
      </section>

      <HomeSections
        anarkali={<ProductGrid products={anarkali} columns={3} />}
        newArrivals={<ProductGrid products={newArrivals} />}
        lehnga={<ProductGrid products={lehnga} />}
      />

      <OccasionStrip />
      <EditorialBand />

      <section className="container-liksha pb-14">
        <div className="grid gap-6 bg-[#f7f2ec] p-7 sm:grid-cols-2 lg:grid-cols-4 lg:p-10">
          {[
            { title: "FREE SHIPPING", text: "Free shipping on all order across India" },
            { title: "SUPPORT 24/7", text: "Contact us 24 hours a day, 7 days a week" },
            { title: "7 DAYS REPLACEMENT", text: "Simply return it within 7 days for an exchange." },
            { title: "100% SECURE PAYMENT", text: "We ensure secure payment" },
          ].map((item) => (
            <div key={item.title} className="text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-[#d9c6b4] text-[#862222]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <path d="m5 13 4 4L19 7" />
                </svg>
              </span>
              <h3 className="mt-3 text-[11px] font-semibold tracking-[.14em] text-[#862222] uppercase">{item.title}</h3>
              <p className="mt-1.5 text-[12px] leading-relaxed text-[#6b6259]">{item.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function CategoryTile({
  href,
  image,
  title,
  count,
  tall = false,
}: {
  href: string;
  image: string;
  title: string;
  count: string;
  tall?: boolean;
}) {
  return (
    <Link href={href} className="group relative block overflow-hidden bg-[#f3ece4]">
      <div className={`relative w-full ${tall ? "aspect-[3/4] sm:aspect-[4/5]" : "aspect-[4/5]"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={title}
          className="h-full w-full object-cover transition-transform duration-[900ms] group-hover:scale-[1.04]"
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
