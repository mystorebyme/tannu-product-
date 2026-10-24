"use client";

import Link from "next/link";
import { useCart } from "@/components/cart-provider";
import { discountPercent, formatPrice } from "@/lib/format";
import type { Product } from "@/lib/store";

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const off = discountPercent(product.price, product.compareAtPrice);

  return (
    <div className="group relative flex flex-col">
      <div className="relative overflow-hidden bg-[#f6f1ec]">
        <Link href={`/products/${product.handle}`} className="block">
          <div className="relative aspect-[3/4] w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.images[0]}
              alt={product.title}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500 group-hover:opacity-0"
            />
            {product.images[1] ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={product.images[1]}
                alt={`${product.title} alternate`}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              />
            ) : null}
          </div>
        </Link>
        {off > 0 ? (
          <span className="absolute left-2 top-2 bg-[#862222] px-1.5 py-0.5 text-[9.5px] font-semibold tracking-[.08em] text-white uppercase">
            {off}% off
          </span>
        ) : null}
        {product.title.toLowerCase().includes("cosmo") ? (
          <span className="absolute right-2 top-2 bg-[#222] px-1.5 py-0.5 text-[9px] font-semibold tracking-[.1em] text-white uppercase">
            New
          </span>
        ) : null}
        <button
          type="button"
          onClick={() =>
            addItem({
              handle: product.handle,
              title: product.title,
              price: product.price,
              compareAtPrice: product.compareAtPrice,
              image: product.images[0],
              size: product.sizes[0] === "Semi-Stitched" ? "Semi-Stitched" : "M",
            })
          }
          className="absolute inset-x-0 bottom-0 translate-y-full bg-[#862222] py-2.5 text-[10.5px] font-semibold tracking-[.16em] text-white uppercase transition-transform duration-300 group-hover:translate-y-0"
        >
          Add to cart
        </button>
      </div>
      <div className="flex flex-1 flex-col pt-2.5 text-center">
        <Link
          href={`/products/${product.handle}`}
          className="line-clamp-2 text-[12px] font-medium leading-snug text-[#2f2a25] transition hover:text-[#862222] sm:text-[12.5px]"
        >
          {product.title}
        </Link>
        <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[12px]">
          {product.compareAtPrice && product.compareAtPrice > product.price ? (
            <span className="text-[#a49a90] line-through">{formatPrice(product.compareAtPrice)}</span>
          ) : null}
          <span className="font-semibold text-[#862222]">{formatPrice(product.price)}</span>
        </div>
      </div>
    </div>
  );
}

export function ProductGrid({
  products,
  columns = 4,
}: {
  products: Product[];
  columns?: 2 | 3 | 4;
}) {
  const gridClass =
    columns === 2
      ? "grid-cols-2"
      : columns === 3
        ? "grid-cols-2 sm:grid-cols-3"
        : "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
  return (
    <div className={`grid gap-x-2.5 gap-y-7 sm:gap-x-5 ${gridClass}`}>
      {products.map((product) => (
        <ProductCard key={product.handle} product={product} />
      ))}
    </div>
  );
}
