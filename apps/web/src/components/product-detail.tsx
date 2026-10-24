"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCart } from "@/components/cart-provider";
import { discountPercent, formatPrice, imageUrl } from "@/lib/format";
import type { Product } from "@/types/catalog";

export function ProductDetail({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [activeImage, setActiveImage] = useState(0);
  const [size, setSize] = useState(product.sizes[1] ?? product.sizes[0] ?? "Free Size");
  const [quantity, setQuantity] = useState(1);
  const [openAccordion, setOpenAccordion] = useState<string | null>("details");
  const [pincode, setPincode] = useState("");
  const [pinMessage, setPinMessage] = useState<string | null>(null);

  const off = discountPercent(product.price, product.compareAtPrice);
  const savings = useMemo(
    () => (product.compareAtPrice ? product.compareAtPrice - product.price : 0),
    [product],
  );

  function buyNow() {
    addItem(
      {
        handle: product.handle,
        title: product.title,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        image: product.images[0],
        size,
      },
      quantity,
    );
  }

  function checkPin() {
    if (!/^\d{6}$/.test(pincode.trim())) {
      setPinMessage("Please enter a valid 6-digit pincode.");
      return;
    }
    setPinMessage(
      /^[1-9]/.test(pincode.trim())
        ? `Delivering to ${pincode.trim()} — free shipping, 4-7 business days.`
        : "Please enter a valid 6-digit pincode.",
    );
  }

  const accordions = [
    {
      key: "details",
      title: "Product Details",
      content: (
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
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
      <div className="flex flex-col-reverse gap-2.5 sm:flex-row">
        {product.images.length > 1 ? (
          <div className="no-scrollbar flex gap-2 overflow-x-auto sm:flex-col sm:overflow-y-auto">
          {product.images.map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => setActiveImage(index)}
              className={`relative h-20 w-16 shrink-0 overflow-hidden border transition sm:h-24 sm:w-[74px] ${
                activeImage === index ? "border-[#862222]" : "border-transparent hover:border-[#d9c6b4]"
              }`}
              aria-label={`View image ${index + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl(image, 200)} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
          </div>
        ) : null}
        <div className="relative flex-1 overflow-hidden bg-[#f6f1ec]">
          <div className="relative aspect-[3/4] w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl(product.images[activeImage], 1200)}
              alt={product.title}
              fetchPriority="high"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
          {off > 0 ? (
            <span className="absolute left-3 top-3 bg-[#862222] px-2 py-1 text-[10px] font-semibold tracking-[.1em] text-white uppercase">
              Save {off}%
            </span>
          ) : null}
          {product.images.length > 1 ? (
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
              {product.images.map((image, index) => (
                <button
                  key={`${image}-dot`}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  aria-label={`Image ${index + 1}`}
                  className={`h-1.5 w-1.5 rounded-full ${activeImage === index ? "bg-[#862222]" : "bg-white/80 ring-1 ring-[#c9b9a8]"}`}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="lg:sticky lg:top-[92px] lg:self-start">
        <p className="text-[10.5px] tracking-[.16em] text-[#9c8f82] uppercase">
          {product.category === "lehnga"
            ? "Lehenga Choli"
            : product.category === "printed"
              ? "Printed Suit Set"
              : product.category === "saree"
                ? "Saree"
                : "Anarkali Suit"}
        </p>
        <h1 className="mt-1.5 font-display text-[24px] leading-snug font-medium text-[#2f2a25] sm:text-[30px]">
          {product.title}
        </h1>

        <div className="mt-2 flex items-center gap-2">
          <span className="flex items-center gap-0.5 text-[13px] text-[#c9972b]">
            {"★".repeat(Math.round(product.rating))}
            <span className="text-[#d8cbbd]">{"★".repeat(5 - Math.round(product.rating))}</span>
          </span>
          <span className="text-[11.5px] text-[#8a8078]">
            {product.rating.toFixed(1)} · {product.reviewCount} reviews
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-baseline gap-2.5">
          <span className="text-[22px] font-semibold text-[#862222]">{formatPrice(product.price)}</span>
          {product.compareAtPrice && product.compareAtPrice > product.price ? (
            <>
              <span className="text-[14px] text-[#a49a90] line-through">
                {formatPrice(product.compareAtPrice)}
              </span>
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
            {product.sizes.map((option) => (
              <button
                key={option}
                type="button"
                data-testid="size-option"
                aria-pressed={size === option}
                onClick={() => setSize(option)}
                className={`min-w-11 border px-3 py-2 text-[12px] transition ${
                  size === option
                    ? "border-[#862222] bg-[#862222] text-white"
                    : "border-[#ddd2c6] text-[#4a423b] hover:border-[#862222]"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
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
            onClick={buyNow}
            data-testid="add-to-cart"
            className="flex-1 bg-[#862222] px-4 py-3 text-[11.5px] font-semibold tracking-[.16em] text-white uppercase transition hover:bg-[#6d1a1a]"
          >
            Add to cart
          </button>
        </div>
        <button
          type="button"
          onClick={buyNow}
          className="mt-2 w-full border border-[#862222] py-3 text-[11.5px] font-semibold tracking-[.16em] text-[#862222] uppercase transition hover:bg-[#faf1ef]"
        >
          Buy it now
        </button>

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

        <div className="mt-3 grid grid-cols-2 gap-2 text-[10.5px] text-[#5c534b] sm:grid-cols-4">
          {["Free shipping", "COD available", "7-day replacement", "Secure payment"].map((item) => (
            <span key={item} className="flex items-center gap-1.5 border border-[#eee6de] px-2 py-2">
              <span className="text-[#862222]">✓</span>
              {item}
            </span>
          ))}
        </div>

        <div className="mt-5 divide-y divide-[#eee6de] border-y border-[#eee6de]">
          {accordions.map((item) => (
            <div key={item.key}>
              <button
                type="button"
                onClick={() => setOpenAccordion(openAccordion === item.key ? null : item.key)}
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

        <p className="mt-4 text-[12.5px] leading-relaxed text-[#6b6259]">{product.description}</p>

        <a
          href="https://wa.me/919909790455"
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
