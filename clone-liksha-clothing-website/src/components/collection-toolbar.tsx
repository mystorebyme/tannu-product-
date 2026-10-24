"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const sortOptions = [
  { value: "featured", label: "Featured" },
  { value: "best-selling", label: "Best selling" },
  { value: "title-asc", label: "Alphabetically, A-Z" },
  { value: "price-asc", label: "Price, low to high" },
  { value: "price-desc", label: "Price, high to low" },
  { value: "newest", label: "Date, new to old" },
];

export function CollectionToolbar({
  basePath,
  total,
  sort,
  priceRange,
}: {
  basePath: string;
  total: number;
  sort: string;
  priceRange: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") params.set(key, value);
      else params.delete(key);
      const query = params.toString();
      router.push(query ? `${basePath}?${query}` : basePath, { scroll: false });
    },
    [basePath, router, searchParams],
  );

  return (
    <div className="flex flex-col gap-3 border-b border-[#eee6de] pb-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[11.5px] tracking-[.1em] text-[#8a8078] uppercase">{total} products</p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={priceRange}
          onChange={(event) => setParam("price", event.target.value)}
          aria-label="Filter by price"
          className="h-9 border border-[#e0d6ca] bg-white px-2.5 text-[11.5px] tracking-[.04em] outline-none focus:border-[#862222]"
        >
          <option value="all">Price: all</option>
          <option value="under-2500">Under Rs. 2,500</option>
          <option value="2500-3000">Rs. 2,500 – 3,000</option>
          <option value="3000-3500">Rs. 3,000 – 3,500</option>
          <option value="above-3500">Above Rs. 3,500</option>
        </select>
        <select
          value={sort}
          onChange={(event) => setParam("sort", event.target.value)}
          aria-label="Sort products"
          className="h-9 border border-[#e0d6ca] bg-white px-2.5 text-[11.5px] tracking-[.04em] outline-none focus:border-[#862222]"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
