"use client";

import { useState } from "react";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/lib/store";

export function ProductGridWithMore({
  products,
  pageSize = 24,
  columns = 4,
}: {
  products: Product[];
  pageSize?: number;
  columns?: 2 | 3 | 4;
}) {
  const [visible, setVisible] = useState(pageSize);
  const gridClass =
    columns === 2
      ? "grid-cols-2"
      : columns === 3
        ? "grid-cols-2 sm:grid-cols-3"
        : "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  return (
    <div>
      <div className={`grid gap-x-2.5 gap-y-7 sm:gap-x-5 ${gridClass}`}>
        {products.slice(0, visible).map((product) => (
          <ProductCard key={product.handle} product={product} />
        ))}
      </div>

      {visible < products.length ? (
        <div className="mt-8 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => setVisible((value) => value + pageSize)}
            className="border border-[#862222] px-8 py-3 text-[11px] font-semibold tracking-[.18em] text-[#862222] uppercase transition hover:bg-[#862222] hover:text-white"
          >
            Load more products
          </button>
          <p className="text-[10.5px] tracking-[.12em] text-[#9c8f82] uppercase">
            Showing {Math.min(visible, products.length)} of {products.length} products
          </p>
        </div>
      ) : products.length > pageSize ? (
        <p className="mt-8 text-center text-[10.5px] tracking-[.12em] text-[#9c8f82] uppercase">
          All {products.length} products shown
        </p>
      ) : null}
    </div>
  );
}
