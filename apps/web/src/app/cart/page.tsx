"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/cart-provider";
import { formatPrice, imageUrl } from "@/lib/format";
import { COUPONS as COUPON_RULES } from "@liksha/validation";
import { SafeImage } from "@/components/safe-image";

// shared package se hi rules aate hain (frontend + backend same)
const COUPONS: Record<string, { percent: number; label: string }> = Object.fromEntries(
  Object.entries(COUPON_RULES).map(([code, percent]) => [
    code,
    { percent, label: `${percent}% off on your order` },
  ]),
);

export default function CartPage() {
  const { lines, subtotal, setQuantity, removeLine } = useCart();
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const discount = applied ? Math.round((subtotal * COUPONS[applied].percent) / 100) : 0;
  const shipping = 0;
  const total = Math.max(0, subtotal - discount + shipping);
  const freeShippingMet = subtotal >= 350000;

  function applyCoupon() {
    const normalised = code.trim().toUpperCase();
    if (COUPONS[normalised]) {
      setApplied(normalised);
      setMessage(`Coupon ${normalised} applied — ${COUPONS[normalised].label}.`);
    } else {
      setApplied(null);
      setMessage("This coupon code is not valid. Try LIKSHA10.");
    }
    try {
      window.sessionStorage.setItem("liksha:coupon", normalised);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="container-liksha py-8 lg:py-12">
      <h1 className="font-display text-[28px] font-medium tracking-[.03em] sm:text-[34px]">Shopping cart</h1>
      <p className="mt-1 text-[11.5px] tracking-[.12em] text-[#9c8f82] uppercase">
        {lines.length} {lines.length === 1 ? "item" : "items"} in your cart
      </p>

      {lines.length === 0 ? (
        <div className="mt-10 border border-[#eee6de] px-6 py-20 text-center">
          <p className="text-sm text-[#6b6259]">Your cart is currently empty.</p>
          <Link
            href="/collections/party-wear-gown"
            className="mt-5 inline-block bg-[#862222] px-7 py-3 text-[11px] font-semibold tracking-[.16em] text-white uppercase"
          >
            Continue shopping
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          <div>
            <div className="hidden border-b border-[#eee6de] pb-2 text-[10.5px] tracking-[.14em] text-[#9c8f82] uppercase sm:grid sm:grid-cols-[1fr_120px_100px_90px]">
              <span>Product</span>
              <span className="text-center">Quantity</span>
              <span className="text-center">Total</span>
              <span />
            </div>
            <ul className="divide-y divide-[#f1ebe5]">
              {lines.map((line) => (
                <li key={line.key} className="grid grid-cols-[84px_1fr] gap-3 py-4 sm:grid-cols-[1fr_120px_100px_90px] sm:items-center">
                  <div className="col-span-2 flex gap-3 sm:col-span-1">
                    <Link href={`/products/${line.handle}`} className="shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <SafeImage src={line.image} alt={line.title} className="h-28 w-[84px] object-cover" />
                    </Link>
                    <div className="flex flex-col">
                      <Link
                        href={`/products/${line.handle}`}
                        className="text-[12.5px] font-medium leading-snug hover:text-[#862222]"
                      >
                        {line.title}
                      </Link>
                      <p className="mt-1 text-[11px] text-[#8a8078]">Size: {line.size}</p>
                      <p className="mt-1 text-[12px] font-semibold text-[#862222]">{formatPrice(line.price)}</p>
                    </div>
                  </div>
                  <div className="flex justify-start sm:justify-center">
                    <div className="flex items-center border border-[#e2d8cd]">
                      <button
                        type="button"
                        onClick={() => setQuantity(line.key, line.quantity - 1)}
                        className="h-8 w-8"
                        aria-label="Decrease"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-xs">{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => setQuantity(line.key, line.quantity + 1)}
                        className="h-8 w-8"
                        aria-label="Increase"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <p className="hidden text-center text-[12.5px] font-semibold sm:block">
                    {formatPrice(line.price * line.quantity)}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    className="justify-self-start text-[10.5px] tracking-[.08em] text-[#9a8f85] uppercase underline sm:justify-self-center"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <Link
              href="/collections/new-arrivals"
              className="mt-5 inline-block border border-[#862222] px-5 py-2.5 text-[10.5px] font-semibold tracking-[.16em] text-[#862222] uppercase"
            >
              Continue shopping
            </Link>
          </div>

          <aside className="h-fit border border-[#eee6de] bg-[#faf8f5] p-5 lg:sticky lg:top-[92px]">
            <h2 className="text-[11px] font-semibold tracking-[.16em] uppercase">Order summary</h2>
            <div className="mt-4 space-y-2 text-[12.5px]">
              <Row label="Subtotal" value={formatPrice(subtotal)} />
              <Row label="Shipping" value={freeShippingMet ? "Free" : "Free (prepaid)"} />
              {discount > 0 ? <Row label="Coupon discount" value={`− ${formatPrice(discount)}`} accent /> : null}
              <div className="flex items-center justify-between border-t border-[#e7ddd2] pt-2.5 text-[14px] font-semibold">
                <span>Total</span>
                <span className="text-[#862222]">{formatPrice(total)}</span>
              </div>
            </div>

            <div className="mt-4">
              <label className="text-[10.5px] tracking-[.14em] uppercase">Coupon code</label>
              <div className="mt-1.5 flex">
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="LIKSHA10"
                  className="h-9 w-full border border-[#ddd2c6] bg-white px-2.5 text-[12px] outline-none focus:border-[#862222]"
                />
                <button
                  type="button"
                  onClick={applyCoupon}
                  className="shrink-0 bg-[#222] px-3.5 text-[10px] font-semibold tracking-[.12em] text-white uppercase"
                >
                  Apply
                </button>
              </div>
              {message ? (
                <p className={`mt-1.5 text-[11px] ${applied ? "text-[#2f7a3f]" : "text-[#b3261e]"}`}>{message}</p>
              ) : (
                <p className="mt-1.5 text-[10.5px] text-[#9c8f82]">Try LIKSHA10 for 10% off.</p>
              )}
            </div>

            <Link
              href={`/checkout${applied ? `?coupon=${applied}` : ""}`}
              className="mt-5 block bg-[#862222] py-3 text-center text-[11.5px] font-semibold tracking-[.16em] text-white uppercase"
            >
              Proceed to checkout
            </Link>
            <p className="mt-2.5 text-center text-[10.5px] text-[#8a8078]">
              100% secure payment · COD under Rs. 3,500
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#6b6259]">{label}</span>
      <span className={accent ? "font-medium text-[#2f7a3f]" : "text-[#3f3830]"}>{value}</span>
    </div>
  );
}
