"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/components/cart-provider";
import { formatPrice, imageUrl } from "@/lib/format";
import {
  COUPONS as COUPON_RULES,
  COD_FEE,
  COD_MAX_SUBTOTAL,
  computeDiscount,
} from "@liksha/validation";
import { SafeImage } from "@/components/safe-image";

const COUPONS: Record<string, number> = COUPON_RULES;

const indianStates = [
  "Andhra Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh", "Delhi", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jammu & Kashmir", "Jharkhand", "Karnataka", "Kerala",
  "Madhya Pradesh", "Maharashtra", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim",
  "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

export function CheckoutForm() {
  const { lines, subtotal, count, clear, isOpen, closeCart } = useCart();
  const router = useRouter();
  const searchParams = useSearchParams();
  const couponFromUrl = searchParams.get("coupon")?.toUpperCase() ?? null;
  const [coupon, setCoupon] = useState<string | null>(
    couponFromUrl && COUPONS[couponFromUrl] ? couponFromUrl : null,
  );
  const [couponInput, setCouponInput] = useState("");
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [payment, setPayment] = useState<"prepaid" | "cod">("prepaid");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    customerName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "Gujarat",
    pincode: "",
    notes: "",
  });

  useEffect(() => {
    if (isOpen) closeCart();
  }, [isOpen, closeCart]);

  const discount = computeDiscount(subtotal, coupon);
  const codFee = payment === "cod" ? COD_FEE : 0;
  const total = Math.max(0, subtotal - discount + codFee);
  const codBlocked = subtotal > COD_MAX_SUBTOTAL;

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function applyCoupon() {
    const normalised = couponInput.trim().toUpperCase();
    if (COUPONS[normalised]) {
      setCoupon(normalised);
      setCouponMessage(`Coupon ${normalised} applied.`);
    } else {
      setCoupon(null);
      setCouponMessage("Invalid coupon code. Try LIKSHA10.");
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lines.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      // idempotency key -> double click par do order nahi bante
      const idempotencyKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          ...form,
          couponCode: coupon,
          paymentMethod: payment,
          items: lines.map((line) => ({
            handle: line.handle,
            size: line.size,
            quantity: line.quantity,
          })),
        }),
      });
      const payload = (await response.json()) as { orderNumber?: string; error?: string };
      if (!response.ok || !payload.orderNumber) {
        setError(payload.error ?? "We could not place your order. Please check the details and try again.");
        setSubmitting(false);
        return;
      }
      clear();
      router.push(`/orders/${payload.orderNumber}`);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  if (lines.length === 0) {
    return (
      <div className="border border-[#eee6de] px-6 py-20 text-center">
        <p className="text-sm text-[#6b6259]">Your cart is empty — add a suit set to checkout.</p>
        <Link
          href="/collections/party-wear-gown"
          className="mt-5 inline-block bg-[#862222] px-7 py-3 text-[11px] font-semibold tracking-[.16em] text-white uppercase"
        >
          Shop now
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
      <div className="space-y-6">
        <section>
          <h2 className="text-[11px] font-semibold tracking-[.16em] text-[#862222] uppercase">Contact</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Full name" required value={form.customerName} onChange={(v) => update("customerName", v)} />
            <Field label="Phone (WhatsApp)" required type="tel" value={form.phone} onChange={(v) => update("phone", v)} />
            <Field
              label="Email"
              required
              type="email"
              className="sm:col-span-2"
              value={form.email}
              onChange={(v) => update("email", v)}
            />
          </div>
        </section>

        <section>
          <h2 className="text-[11px] font-semibold tracking-[.16em] text-[#862222] uppercase">Shipping address</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field
              label="Address (house, street, area)"
              required
              className="sm:col-span-2"
              value={form.address}
              onChange={(v) => update("address", v)}
            />
            <Field label="City" required value={form.city} onChange={(v) => update("city", v)} />
            <div>
              <label className="text-[10.5px] tracking-[.12em] text-[#6b6259] uppercase">State</label>
              <select
                value={form.state}
                onChange={(event) => update("state", event.target.value)}
                className="mt-1 h-11 w-full border border-[#ddd2c6] bg-white px-3 text-[13px] outline-none focus:border-[#862222]"
              >
                {indianStates.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </div>
            <Field
              label="Pincode"
              required
              inputMode="numeric"
              value={form.pincode}
              onChange={(v) => update("pincode", v.replace(/\D/g, "").slice(0, 6))}
            />
            <Field label="Order notes (optional)" value={form.notes} onChange={(v) => update("notes", v)} />
          </div>
        </section>

        <section>
          <h2 className="text-[11px] font-semibold tracking-[.16em] text-[#862222] uppercase">Payment</h2>
          <div className="mt-3 space-y-2">
            <label
              className={`flex cursor-pointer items-start gap-3 border p-3 ${
                payment === "prepaid" ? "border-[#862222] bg-[#fdf8f7]" : "border-[#e5dbd0]"
              }`}
            >
              <input
                type="radio"
                name="payment"
                checked={payment === "prepaid"}
                onChange={() => setPayment("prepaid")}
                className="mt-0.5 accent-[#862222]"
              />
              <span>
                <span className="block text-[12.5px] font-medium">Prepaid — UPI / Card / Netbanking</span>
                <span className="mt-0.5 block text-[11.5px] text-[#8a8078]">
                  Express delivery, priority dispatch and free shipping.
                </span>
              </span>
            </label>
            <label
              className={`flex cursor-pointer items-start gap-3 border p-3 ${
                payment === "cod" ? "border-[#862222] bg-[#fdf8f7]" : "border-[#e5dbd0]"
              } ${codBlocked ? "opacity-60" : ""}`}
            >
              <input
                type="radio"
                name="payment"
                disabled={codBlocked}
                checked={payment === "cod"}
                onChange={() => setPayment("cod")}
                className="mt-0.5 accent-[#862222]"
              />
              <span>
                <span className="block text-[12.5px] font-medium">Cash on delivery (+ Rs. 50 fee)</span>
                <span className="mt-0.5 block text-[11.5px] text-[#8a8078]">
                  {codBlocked
                    ? "COD is available only on orders under Rs. 3,500."
                    : "Available on orders under Rs. 3,500 across India."}
                </span>
              </span>
            </label>
          </div>
        </section>
      </div>

      <aside className="h-fit border border-[#eee6de] bg-[#faf8f5] p-5 lg:sticky lg:top-[92px]">
        <h2 className="text-[11px] font-semibold tracking-[.16em] uppercase">Order summary ({count})</h2>
        <ul className="mt-3 divide-y divide-[#eee6de]">
          {lines.map((line) => (
            <li key={line.key} className="flex gap-2.5 py-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <SafeImage src={imageUrl(line.image, 200)} alt={line.title} className="h-16 w-12 shrink-0 object-cover" />
              <div className="flex-1">
                <p className="line-clamp-2 text-[11.5px] leading-snug">{line.title}</p>
                <p className="mt-0.5 text-[10.5px] text-[#8a8078]">
                  {line.size} · Qty {line.quantity}
                </p>
              </div>
              <span className="text-[11.5px] font-medium">{formatPrice(line.price * line.quantity)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex">
          <input
            value={couponInput}
            onChange={(event) => setCouponInput(event.target.value)}
            placeholder="Coupon code"
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
        {couponMessage ? (
          <p className={`mt-1.5 text-[11px] ${coupon ? "text-[#2f7a3f]" : "text-[#b3261e]"}`}>{couponMessage}</p>
        ) : null}

        <div className="mt-4 space-y-2 border-t border-[#e7ddd2] pt-3 text-[12.5px]">
          <div className="flex justify-between">
            <span className="text-[#6b6259]">Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#6b6259]">Shipping</span>
            <span className="text-[#2f7a3f]">Free</span>
          </div>
          {discount > 0 ? (
            <div className="flex justify-between text-[#2f7a3f]">
              <span>Coupon ({coupon})</span>
              <span>− {formatPrice(discount)}</span>
            </div>
          ) : null}
          {codFee > 0 ? (
            <div className="flex justify-between">
              <span className="text-[#6b6259]">COD fee</span>
              <span>{formatPrice(codFee)}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between border-t border-[#e7ddd2] pt-2.5 text-[14.5px] font-semibold">
            <span>Total</span>
            <span className="text-[#862222]">{formatPrice(total)}</span>
          </div>
        </div>

        {error ? <p className="mt-3 text-[11.5px] text-[#b3261e]">{error}</p> : null}

        <button
          type="submit"
          data-testid="checkout-submit"
          disabled={submitting}
          className="mt-4 w-full bg-[#862222] py-3 text-[11.5px] font-semibold tracking-[.16em] text-white uppercase disabled:opacity-60"
        >
          {submitting ? "Placing order…" : `Place order · ${formatPrice(total)}`}
        </button>
        <p className="mt-2 text-center text-[10.5px] leading-relaxed text-[#8a8078]">
          By placing this order you agree to our{" "}
          <Link href="/policies/terms-and-conditions" className="underline">
            Terms &amp; Conditions
          </Link>
          ,{" "}
          <Link href="/policies/refund-and-return-policy" className="underline">
            Refund &amp; Return
          </Link>{" "}
          and{" "}
          <Link href="/policies/privacy-policy" className="underline">
            Privacy
          </Link>{" "}
          policies.
        </p>
      </aside>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
  className = "",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  className?: string;
  inputMode?: "numeric" | "text" | "tel" | "email";
}) {
  return (
    <div className={className}>
      <label className="text-[10.5px] tracking-[.12em] text-[#6b6259] uppercase">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        inputMode={inputMode}
        className="mt-1 h-11 w-full border border-[#ddd2c6] bg-white px-3 text-[13px] outline-none focus:border-[#862222]"
      />
    </div>
  );
}
