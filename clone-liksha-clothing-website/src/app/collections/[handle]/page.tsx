import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProductGridWithMore } from "@/components/product-grid-client";
import { CollectionToolbar } from "@/components/collection-toolbar";
import {
  getCollection,
  getCollections,
  getProductsByCollection,
  isSortKey,
  sortProducts,
  type Product,
} from "@/lib/store";

export const dynamic = "force-dynamic";

type Params = { handle: string };
type Search = { sort?: string; price?: string };

const priceFilters: Record<string, (product: Product) => boolean> = {
  "under-2500": (p) => p.price < 250000,
  "2500-3000": (p) => p.price >= 250000 && p.price < 300000,
  "3000-3500": (p) => p.price >= 300000 && p.price < 350000,
  "above-3500": (p) => p.price >= 350000,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { handle } = await params;
  const collection = await getCollection(handle);
  if (!collection) return { title: "Collection not found" };
  return {
    title: collection.title,
    description: `${collection.title} — ${collection.subtitle} at Liksha Clothing.`,
  };
}

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { handle } = await params;
  const { sort, price } = await searchParams;
  const collection = await getCollection(handle);
  if (!collection) notFound();

  const allCollections = await getCollections();
  let products = await getProductsByCollection(handle);

  if (collection.handle === "weddin-collection" && products.length === 0) {
    const all = await getProductsByCollection("party-wear-gown");
    products = all.filter((product) => product.price >= 300000);
  }
  if (collection.handle === "saree" && products.length === 0) {
    const all = await getProductsByCollection("all");
    products = all.filter((product) => product.category === "printed").slice(0, 12);
  }

  if (price && priceFilters[price]) {
    products = products.filter(priceFilters[price]);
  }

  const sortKey = isSortKey(sort) ? sort : "featured";
  const ordered = sortProducts(products, sortKey);

  return (
    <div>
      <nav aria-label="Breadcrumb" className="container-liksha pt-5">
        <ol className="flex items-center gap-1.5 text-[11px] text-[#9c8f82]">
          <li>
            <Link href="/" className="hover:text-[#862222]">Home</Link>
          </li>
          <li>/</li>
          <li className="text-[#5c534b]">{collection.title}</li>
        </ol>
      </nav>

      <header className="container-liksha pt-3 pb-5 text-center">
        <h1 className="font-display text-[30px] leading-tight font-medium tracking-[.03em] text-[#2f2a25] sm:text-[38px]">
          {collection.title}
        </h1>
        <p className="mt-1 text-[11.5px] tracking-[.14em] text-[#9c8f82] uppercase">{collection.subtitle}</p>
      </header>

      <div className="container-liksha">
        <CollectionToolbar
          basePath={`/collections/${collection.handle}`}
          total={ordered.length}
          sort={sortKey}
          priceRange={price ?? "all"}
        />
      </div>

      <div className="container-liksha pt-5 pb-12">
        {ordered.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm text-[#6b6259]">No products were found matching your selection.</p>
            <Link
              href="/collections/party-wear-gown"
              className="mt-4 inline-block bg-[#862222] px-6 py-3 text-[11px] font-semibold tracking-[.16em] text-white uppercase"
            >
              Shop Anarkali Suits
            </Link>
          </div>
        ) : (
          <ProductGridWithMore products={ordered} />
        )}

        <div className="mt-14 border-t border-[#eee6de] pt-8">
          <h2 className="text-center text-[11px] font-semibold tracking-[.18em] text-[#862222] uppercase">
            Explore more collections
          </h2>
          <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:justify-center">
            {allCollections.map((item) => (
              <Link
                key={item.handle}
                href={`/collections/${item.handle}`}
                className={`whitespace-nowrap border px-3.5 py-2 text-[11px] tracking-[.08em] uppercase transition ${
                  item.handle === collection.handle
                    ? "border-[#862222] bg-[#862222] text-white"
                    : "border-[#e0d6ca] text-[#5c534b] hover:border-[#862222] hover:text-[#862222]"
                }`}
              >
                {item.title}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
