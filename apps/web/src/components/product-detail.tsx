"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCart } from "@/components/cart-provider";
import { discountPercent, formatPrice } from "@/lib/format";
import { categoryHref, categoryLabel } from "@/lib/categories";
import type { Product } from "@/types/catalog";
import { ProductGallery } from "@/components/product-gallery";

export function ProductDetail({ product }: { product: Product }) {
  const { addItem } = useCart();
  const firstAvailable =
    product.sizes.find((size) => product.sizePricing?.[size]?.available) ??
    product.sizes[0] ??
    "Free Size";
  const [size, setSize] = useState(firstAvailable);
  const [quantity, setQuantity] = useState(1);
  const [openAccordion, setOpenAccordion] = useState<string | null>("details");
  const [pincode, setPincode] = useState("");
  const [pinMessage, setPinMessage] = useState<string | null>(null);

  const sizePricing = product.sizePricing?.[size];
  const price = sizePricing?.price ?? product.price;
  const compareAt = sizePricing?.compareAtPrice ?? product.compareAtPrice;
  const off = discountPercent(price, compareAt);
  const savings = useMemo(() => (compareAt ? compareAt - price : 0), [compareAt, price]);

  function add(quantityOverride?: number) {
    addItem(
      {
        handle: product.handle,
        title: product.title,
        price,
        compareAtPrice: compareAt ?? null,
        image: product.images[0],
        size,
      },
      quantityOverride ?? quantity,
    );
  }

  function checkPin() {
    if (!/^[1-9]\d{5}$/.test(pincode.trim())) {
      setPinMessage("Please enter a valid 6-digit pincode.");
      return;
    }
    setPinMessage(`Delivering to ${pincode.trim()} — free shipping, 4-7 business days. COD under Rs. 3,500.`);
  }

  const accordions = [
    {
      key: "details",
      title: "Product Details",
      content: product.descriptionHtml ? (
        <div
          className="product-rich text-[12.5px] leading-relaxed text-[#5c534b] [&_br]:block [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2 [&_strong]:font-semibold"
          // live store ka body_html — build script me sanitize hota hai (script/iframe/img strip)
          dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
        />
      ) : (
        <ul className="space-y-1.5">
          {product.details.map((detail) => (
            <li key={detail} className="flex gap-2 text-[12.5px] leading-relaxed text-[#5c534b]">
              <span className="text-[#862222]">•</span>
              <span>{detail}</span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      key: "shipping",
      title: "Shipping & Delivery",
      content: (
        <p className="text-[12.5px] leading-relaxed text-[#5c534b]">
          Ready to dispatch in 1-2 days. Free shipping across India. Prepaid orders are delivered in
          4-7 business days; COD is available on orders under Rs. 3,500. For multiple items, an
          advance payment is required.
        </p>
      ),
    },
    {
      key: "returns",
      title: "7 Days Replacement",
      content: (
        <p className="text-[12.5px] leading-relaxed text-[#5c534b]">
          Simply return it within 7 days for an exchange. The product must be unused with all tags
          intact. Raise a request on WhatsApp 9909790455 with your order number.
        </p>
      ),
    },
    {
      key: "care",
      title: "Fabric Care",
      content: (
        <p className="text-[12.5px] leading-relaxed text-[#5c534b]">
          Dry clean only. Store in a muslin garment bag, avoid direct contact with perfume and
          deodorant, and iron on low heat from the reverse side.
        </p>
      ),
    },
  ];

  return (
    <div className="group grid gap-8 lg:grid-cols-2 lg:gap-12">
      <ProductGallery
        images={product.images}
        title={product.title}
        badge={off > 0 ? `Save ${off}%` : null}
      />

      <div className="lg:sticky lg:top-[92px] lg:self-start">
        <p className="text-[10.5px] tracking-[.16em] text-[#9c8f82] uppercase">
          <Link href={categoryHref(product.category)} className="hover:text-[#862222]">
            {categoryLabel(product.category)}
          </Link>
          {product.productType ? <span className="text-[#c9bdb1]"> · {product.productType}</span> : null}
        </p>
        <h1 className="mt-1.5 font-display text-[24px] leading-snug font-medium text-[#2f2a25] sm:text-[30px]">
          {product.title}
        </h1>

        <div className="mt-3 flex flex-wrap items-baseline gap-2.5">
          <span className="text-[22px] font-semibold text-[#862222]" data-testid="product-price">
            {formatPrice(price)}
          </span>
          {compareAt && compareAt > price ? (
            <>
              <span className="text-[14px] text-[#a49a90] line-through">{formatPrice(compareAt)}</span>
              <span className="bg-[#fbeaea] px-1.5 py-0.5 text-[10.5px] font-semibold tracking-[.06em] text-[#862222] uppercase">
                {off}% off
              </span>
            </>
          ) : null}
        </div>
        {savings > 0 ? (
          <p className="mt-1 text-[12px] text-[#2f7a3f]">You save {formatPrice(savings)} today</p>
        ) : null}
        <p className="mt-1 text-[11.5px] text-[#8a8078]">Inclusive of all taxes</p>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-y border-[#eee6de] py-3 text-[11.5px] text-[#6b6259]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#3ba55d]" /> Colour: {product.color}
          </span>
          <span>Fabric: {product.fabric}</span>
          <span>{product.images.length} photos</span>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold tracking-[.14em] uppercase">
              Select size: <span className="text-[#862222]">{size}</span>
            </p>
            <Link href="/pages/size-guide" className="text-[11px] text-[#862222] underline">
              Size guide
            </Link>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {product.sizes.map((option) => {
              const optionPricing = product.sizePricing?.[option];
              const soldOut = optionPricing ? !optionPricing.available : false;
              return (
                <button
                  key={option}
                  type="button"
                  data-testid="size-option"
                  aria-pressed={size === option}
                  onClick={() => setSize(option)}
                  className={`min-w-11 border px-3 py-2 text-[12px] transition ${
                    size === option
                      ? "border-[#862222] bg-[#862222] text-white"
                      : soldOut
                        ? "border-[#eee6de] text-[#bdb2a7] line-through hover:border-[#ddd2c6]"
                        : "border-[#ddd2c6] text-[#4a423b] hover:border-[#862222]"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
          {sizePricing && !sizePricing.available ? (
            <p className="mt-2 text-[11.5px] text-[#b3261e]">
              {size} is out of stock — WhatsApp 9909790455 for the next drop.
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <div className="flex items-center border border-[#ddd2c6]">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="h-11 w-10 text-base"
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="w-9 text-center text-[13px]">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(10, q + 1))}
              className="h-11 w-10 text-base"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={() => add()}
            data-testid="add-to-cart"
            disabled={Boolean(sizePricing && !sizePricing.available)}
            className="flex-1 bg-[#862222] px-4 py-3 text-[11.5px] font-semibold tracking-[.16em] text-white uppercase transition hover:bg-[#6d1a1a] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sizePricing && !sizePricing.available ? "Out of stock" : "Add to cart"}
          </button>
        </div>
        <button
          type="button"
          onClick={() => add(1)}
          className="mt-2 w-full border border-[#862222] py-3 text-[11.5px] font-semibold tracking-[.16em] text-[#862222] uppercase transition hover:bg-[#faf1ef]"
        >
          Buy it now
        </button>

        <p className="mt-3 text-[11px] tracking-[.06em] text-[#8a8078]">
          Free shipping across India · COD under Rs. 3,500 · 7 days replacement
        </p>

        <div className="mt-4 border border-[#eee6de] bg-[#faf8f5] p-3">
          <p className="text-[10.5px] font-semibold tracking-[.14em] uppercase">Check delivery</p>
          <div className="mt-2 flex">
            <input
              value={pincode}
              onChange={(event) => setPincode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Enter pincode"
              inputMode="numeric"
              className="h-9 w-full border border-[#ddd2c6] bg-white px-2.5 text-[12px] outline-none focus:border-[#862222]"
            />
            <button
              type="button"
              onClick={checkPin}
              className="shrink-0 bg-[#222] px-3.5 text-[10.5px] font-semibold tracking-[.12em] text-white uppercase"
            >
              Check
            </button>
          </div>
          {pinMessage ? <p className="mt-1.5 text-[11.5px] text-[#5c534b]">{pinMessage}</p> : null}
        </div>

        <div className="mt-5 divide-y divide-[#eee6de] border-y border-[#eee6de]">
          {accordions.map((item) => (
            <div key={item.key}>
              <button
                type="button"
                onClick={() => setOpenAccordion(openAccordion === item.key ? null : item.key)}
                aria-expanded={openAccordion === item.key}
                className="flex w-full items-center justify-between py-3 text-left text-[11.5px] font-semibold tracking-[.12em] uppercase"
              >
                {item.title}
                <span className="text-base leading-none text-[#862222]">
                  {openAccordion === item.key ? "−" : "+"}
                </span>
              </button>
              {openAccordion === item.key ? <div className="pb-3">{item.content}</div> : null}
            </div>
          ))}
        </div>

        <a
          href={`https://wa.me/919909790455?text=${encodeURIComponent(
            `Hi Liksha Clothing, I want to order: ${product.title} (${size})`,
          )}`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 flex items-center justify-center gap-2 border border-[#d9c6b4] py-2.5 text-[11px] font-semibold tracking-[.14em] text-[#3f3830] uppercase"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M20 12a8 8 0 0 1-11.7 7.1L4 20l1-4.2A8 8 0 1 1 20 12Z" />
          </svg>
          Order on WhatsApp
        </a>
      </div>
    </div>
  );
}
