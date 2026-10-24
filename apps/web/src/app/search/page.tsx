import type { Metadata } from "next";
import { ProductGrid } from "@/components/product-card";
import { ProductGridWithMore } from "@/components/product-grid-client";
import { getProducts } from "@/lib/store";
import { SearchBar } from "@/components/search-bar";

export const metadata: Metadata = { title: "Search" };
export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const term = (q ?? "").trim();
  const products = await getProducts();
  const results = term
    ? products.filter((product) => {
        const haystack = `${product.title} ${product.color} ${product.fabric} ${product.category}`.toLowerCase();
        return term
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean)
          .every((word) => haystack.includes(word));
      })
    : [];

  return (
    <div className="container-liksha py-9">
      <div className="mx-auto max-w-[640px] text-center">
        <h1 className="font-display text-[28px] font-medium sm:text-[34px]">Search our store</h1>
        <p className="mt-1 text-[11px] tracking-[.14em] text-[#9c8f82] uppercase">
          Anarkali suits · Lehenga choli · Printed suit sets
        </p>
        <div className="mt-4">
          <SearchBar initialQuery={term} />
        </div>
      </div>

      <div className="mt-9">
        {term ? (
          <>
            <p className="mb-5 text-[11.5px] tracking-[.1em] text-[#8a8078] uppercase">
              {results.length} results for &ldquo;{term}&rdquo;
            </p>
            {results.length > 0 ? (
              <ProductGridWithMore
                initial={results.slice(0, 24)}
                total={results.length}
                query={`q=${encodeURIComponent(term)}`}
              />
            ) : (
              <p className="py-16 text-center text-sm text-[#6b6259]">
                No products were found matching your selection.
              </p>
            )}
          </>
        ) : (
          <div className="py-10 text-center">
            <p className="text-[12px] tracking-[.14em] text-[#9c8f82] uppercase">Popular searches</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {["Anarkali", "Lehenga", "Black", "Ivory", "Printed", "Georgette", "Maroon", "Silk"].map((tag) => (
                <a
                  key={tag}
                  href={`/search?q=${encodeURIComponent(tag)}`}
                  className="border border-[#e0d6ca] px-3 py-1.5 text-[11.5px] hover:border-[#862222] hover:text-[#862222]"
                >
                  {tag}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
