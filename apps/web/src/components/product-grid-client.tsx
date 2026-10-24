"use client";

import { readJson } from "@/lib/http-json";

import { useState } from "react";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/types/catalog";

/**
 * Pehla page server se aata hai (fast paint), baaki products client-side
 * API se load hote hain — isliye 287 products ka HTML ek saath nahi bhejna padta.
 */
export function ProductGridWithMore({
  initial,
  total,
  query = "",
  pageSize = 24,
  columns = 4,
}: {
  initial: Product[];
  total: number;
  query?: string;
  pageSize?: number;
  columns?: 2 | 3 | 4;
}) {
  const [products, setProducts] = useState<Product[]>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gridClass =
    columns === 2
      ? "grid-cols-2"
      : columns === 3
        ? "grid-cols-2 sm:grid-cols-3"
        : "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  async function loadMore() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(query);
      params.set("offset", String(products.length));
      params.set("limit", String(pageSize));
      const response = await fetch(`/api/products?${params.toString()}`);
      if (!response.ok) throw new Error("failed");
      const parsed = await readJson<{ data: Product[] }>(response);
      if (!parsed.data?.data) throw new Error("failed");
      setProducts((current) => [...current, ...parsed.data!.data]);
    } catch {
      setError("Aur products load nahi hue. Internet check kar ke dobara try kariye.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className={`grid gap-x-2.5 gap-y-7 sm:gap-x-5 ${gridClass}`}>
        {products.map((product) => (
          <ProductCard key={product.handle} product={product} />
        ))}
      </div>

      {products.length < total ? (
        <div className="mt-8 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="border border-[#862222] px-8 py-3 text-[11px] font-semibold tracking-[.18em] text-[#862222] uppercase transition hover:bg-[#862222] hover:text-white disabled:opacity-60"
          >
            {loading ? "Loading…" : "Load more products"}
          </button>
          <p className="text-[10.5px] tracking-[.12em] text-[#9c8f82] uppercase">
            Showing {products.length} of {total} products
          </p>
          {error ? <p className="text-[11px] text-[#b3261e]">{error}</p> : null}
        </div>
      ) : total > pageSize ? (
        <p className="mt-8 text-center text-[10.5px] tracking-[.12em] text-[#9c8f82] uppercase">
          All {total} products shown
        </p>
      ) : null}
    </div>
  );
}
