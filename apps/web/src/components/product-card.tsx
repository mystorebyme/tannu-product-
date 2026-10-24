"use client";

import Link from "next/link";
import { useCart } from "@/components/cart-provider";
import { discountPercent, formatPrice, imageUrl } from "@/lib/format";
import type { Product } from "@/types/catalog";
import { SafeImage } from "@/components/safe-image";
import { colourSwatch } from "@/lib/colour";
import { coloursFor } from "@/lib/colour-index";

/**
 * Product card — live store jaisa hover behaviour:
 *  - hover par doosri image cross-fade (product ki apni gallery se)
 *  - "Add to cart" niche se slide-up
 *  - image par slow zoom
 */
export function ProductCard({
  product,
  colours,
}: {
  product: Product;
  colours?: { name: string; handle: string }[];
}) {
  const { addItem } = useCart();
  const colourOptions = colours ?? coloursFor(product.handle);
  const off = discountPercent(product.price, product.compareAtPrice);
  const primary = product.images[0];
  const hoverImage = product.images[1] ?? null;
  const defaultSize =
    product.sizes.find((size) => product.sizePricing?.[size]?.available) ?? product.sizes[0] ?? "Free Size";

  return (
    <div className="group relative flex flex-col">
      <div className="relative overflow-hidden bg-[#f6f1ec]">
        <Link href={`/products/${product.handle}`} className="block" data-testid="product-card">
          <div className="card-media relative aspect-[3/4] w-full">
            <SafeImage
              src={imageUrl(primary, 600)}
              alt={product.title}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="card-media-primary absolute inset-0 h-full w-full object-cover"
            />
            {hoverImage ? (
              <SafeImage
                src={imageUrl(hoverImage, 600)}
                alt=""
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="card-media-alt absolute inset-0 h-full w-full object-cover"
              />
            ) : null}
          </div>
        </Link>

        {off > 0 ? (
          <span className="absolute left-2 top-2 bg-[#862222] px-1.5 py-0.5 text-[9.5px] font-semibold tracking-[.08em] text-white uppercase">
            {off}% off
          </span>
        ) : null}
        {!product.inStock ? (
          <span className="absolute right-2 top-2 bg-[#222] px-1.5 py-0.5 text-[9px] font-semibold tracking-[.1em] text-white uppercase">
            Sold out
          </span>
        ) : null}

        <button
          type="button"
          onClick={() =>
            addItem({
              handle: product.handle,
              title: product.title,
              price: product.sizePricing?.[defaultSize]?.price ?? product.price,
              compareAtPrice: product.compareAtPrice,
              image: imageUrl(primary, 400),
              size: defaultSize,
              colour: product.colourName ?? product.color,
            })
          }
          className="absolute inset-x-0 bottom-0 translate-y-full bg-[#862222] py-2.5 text-[10.5px] font-semibold tracking-[.16em] text-white uppercase transition-transform duration-300 group-hover:translate-y-0 focus-visible:translate-y-0 max-sm:translate-y-0"
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
        {colourOptions.length > 1 ? (
          <div className="mt-1.5 flex items-center justify-center gap-1.5">
            {colourOptions.slice(0, 6).map((colour) => (
              <Link
                key={colour.handle}
                href={`/products/${colour.handle}`}
                title={colour.name}
                aria-label={`View ${colour.name}`}
                className="h-3 w-3 rounded-full border border-black/10 transition hover:scale-110"
                style={{ backgroundColor: colourSwatch(colour.name) }}
              />
            ))}
            {colourOptions.length > 6 ? (
              <span className="text-[9.5px] text-[#a49a90]">+{colourOptions.length - 6}</span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ProductGrid({
  products,
  columns = 4,
  colourGroups = {},
}: {
  products: Product[];
  columns?: 2 | 3 | 4;
  /** product handle → uske colour options (card par swatch dots) */
  colourGroups?: Record<string, { name: string; handle: string }[]>;
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
        <ProductCard key={product.handle} product={product} colours={colourGroups[product.handle]} />
      ))}
    </div>
  );
}
