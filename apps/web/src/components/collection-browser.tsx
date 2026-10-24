"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CollectionToolbar } from "@/components/collection-toolbar";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/types/catalog";

const PAGE_SIZE = 24;

/**
 * Collection page ka interactive hissa.
 *
 * Page khud static HTML hai (no searchParams): pehle 24 products server se aate hain,
 * sort/price change par sirf grid fetch hota hai — full page reload nahi, URL
 * `replaceState` se sync rehta hai. Isliye PLP ka TTFB CDN edge se aata hai.
 */
export function CollectionBrowser({
  handle,
  initial,
  initialTotal,
  emptyState,
}: {
  handle: string;
  initial: Product[];
  initialTotal: number;
  emptyState?: React.ReactNode;
}) {
  const [items, setItems] = useState<Product[]>(initial);
  const [total, setTotal] = useState(initialTotal);
  const [sort, setSort] = useState("featured");
  const [price, setPrice] = useState("all");
  const [loading, setLoading] = useState(false);
  const [appending, setAppending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstRender = useRef(true);

  const buildQuery = useCallback(
    (nextSort: string, nextPrice: string) => {
      const params = new URLSearchParams({ collection: handle, sort: nextSort, price: nextPrice, limit: String(PAGE_SIZE) });
      return params.toString();
    },
    [handle],
  );

  const fetchPage = useCallback(
    async (nextSort: string, nextPrice: string, offset: number) => {
      const query = buildQuery(nextSort, nextPrice);
      const response = await fetch(`/api/products?${query}&offset=${offset}`);
      if (!response.ok) throw new Error("request failed");
      return (await response.json()) as { data: Product[]; total: number };
    },
    [buildQuery],
  );

  const applyFilters = useCallback(
    async (nextSort: string, nextPrice: string) => {
      setLoading(true);
      setError(null);
      try {
        const payload = await fetchPage(nextSort, nextPrice, 0);
        setItems(payload.data);
        setTotal(payload.total);
      } catch {
        setError("Products load nahi hue. Internet check kar ke dobara try kariye.");
      } finally {
        setLoading(false);
      }
    },
    [fetchPage],
  );

  // shared link (?sort=price-low&price=under-2500) khulta hai to wahi state apply karo
  useEffect(() => {
    if (!firstRender.current) return;
    firstRender.current = false;
    const params = new URLSearchParams(window.location.search);
    const nextSort = params.get("sort") ?? "featured";
    const nextPrice = params.get("price") ?? "all";
    if (nextSort === "featured" && nextPrice === "all") return;
    setSort(nextSort);
    setPrice(nextPrice);
    void applyFilters(nextSort, nextPrice);
  }, [applyFilters]);

  const syncUrl = useCallback(
    (nextSort: string, nextPrice: string) => {
      const params = new URLSearchParams();
      if (nextSort !== "featured") params.set("sort", nextSort);
      if (nextPrice !== "all") params.set("price", nextPrice);
      const suffix = params.toString();
      window.history.replaceState(null, "", suffix ? `?${suffix}` : window.location.pathname);
    },
    [],
  );

  function handleSort(value: string) {
    setSort(value);
    syncUrl(value, price);
    void applyFilters(value, price);
  }

  function handlePrice(value: string) {
    setPrice(value);
    syncUrl(sort, value);
    void applyFilters(sort, value);
  }

  async function loadMore() {
    setAppending(true);
    setError(null);
    try {
      const payload = await fetchPage(sort, price, items.length);
      setItems((current) => [...current, ...payload.data]);
      setTotal(payload.total);
    } catch {
      setError("Aur products load nahi hue. Dobara try kariye.");
    } finally {
      setAppending(false);
    }
  }

  return (
    <div className="container-liksha">
      <CollectionToolbar
        total={total}
        sort={sort}
        priceRange={price}
        loading={loading}
        onSortChange={handleSort}
        onPriceChange={handlePrice}
      />

      <div className="pt-5 pb-12">
        {items.length === 0 ? (
          (emptyState ?? (
            <div className="py-20 text-center">
              <p className="font-display text-[24px] text-[#2f2a25]">No styles here just yet</p>
              <p className="mx-auto mt-2 max-w-[420px] text-[12.5px] leading-relaxed text-[#6b6259]">
                Try a different filter, or browse the edits our customers are loving right now.
              </p>
            </div>
          ))
        ) : (
          <>
            <div
              className={`grid grid-cols-2 gap-x-2.5 gap-y-7 transition-opacity sm:gap-x-5 lg:grid-cols-3 xl:grid-cols-4 ${
                loading ? "opacity-50" : "opacity-100"
              }`}
            >
              {items.map((product) => (
                <ProductCard key={product.handle} product={product} />
              ))}
            </div>

            {error ? <p className="mt-5 text-center text-[12px] text-[#a02020]">{error}</p> : null}

            {items.length < total ? (
              <div className="mt-10 text-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={appending || loading}
                  className="border border-[#862222] px-8 py-3 text-[11px] font-semibold tracking-[.16em] text-[#862222] uppercase transition hover:bg-[#862222] hover:text-white disabled:opacity-50"
                >
                  {appending ? "Loading…" : `Load more (${total - items.length} left)`}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
