"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/components/cart-provider";
import { formatPrice, imageUrl } from "@/lib/format";
import { SafeImage } from "@/components/safe-image";
import { useStoreSettings } from "@/components/store-settings-provider";
import { API_AVAILABLE, apiUrl } from "@/lib/api-base";
import { buildUpiUri } from "@/lib/upi";
import { UpiQr } from "@/components/upi-qr";
import { UpiApps } from "@/components/upi-apps";
import { postJson, readJson } from "@/lib/http-json";
import { checkPincodeOffline } from "@/lib/pincode-offline";

const indianStates = [
  "Andhra Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh", "Delhi", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jammu & Kashmir", "Jharkhand", "Karnataka", "Kerala",
  "Madhya Pradesh", "Maharashtra", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim",
  "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

export function CheckoutForm() {
  const { lines, subtotal, count, clear, isOpen, closeCart, removeLine } = useCart();
  const router = useRouter();
  // festive sale me final price already 499–699 hai — koi extra coupon nahi
  const { upiId, upiName, whatsapp } = useStoreSettings();
  const [whatsappHref, setWhatsappHref] = useState<string | null>(null);
  // sirf prepaid — COD option hata diya gaya hai
  const payment = "prepaid" as const;
  const [submitting, setSubmitting] = useState(false);
  // OTP step hata diya gaya hai (owner request) — order sirf details par
  const [error, setError] = useState<string | null>(null);
  // delivery check — admin ke rules + India Post data se
  const [pinStatus, setPinStatus] = useState<
    { ok: boolean; message: string; state: string | null; district: string | null } | null
  >(null);
  const [pinBusy, setPinBusy] = useState(false);
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

  // 6 digit poore hone par apne aap check — galat/blocked pincode par aage nahi jaane dete
  useEffect(() => {
    const pin = form.pincode;
    if (pin.length !== 6) {
      setPinStatus(null);
      return;
    }
    let active = true;
    setPinBusy(true);
    const timer = setTimeout(() => {
      fetch(`/api/delivery/check?pincode=${encodeURIComponent(pin)}`, { cache: "no-store" })
        .then((response) => readJson<{ data?: { serviceable: boolean; message: string; state: string | null; district: string | null } }>(response))
        .then(async (parsed) => {
          if (!active) return;
          // API na ho (static Pages) ya reply kharab ho to India Post data se khud check
          const result = parsed.data?.data ?? (await checkPincodeOffline(pin));
          if (!active) return;
          setPinStatus({ ok: result.serviceable, message: result.message, state: result.state, district: result.district });
          // state auto-fill: admin ne jis state ko allow kiya hai wahi select rahe
          if (result.serviceable && result.state) update("state", result.state);
        })
        .catch(async () => {
          if (!active) return;
          const result = await checkPincodeOffline(pin);
          if (!active) return;
          setPinStatus({ ok: result.serviceable, message: result.message, state: result.state, district: result.district });
          if (result.serviceable && result.state) update("state", result.state);
        })
        .finally(() => {
          if (active) setPinBusy(false);
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
      setPinBusy(false);
    };
  }, [form.pincode]);

  const discount = 0;
  const total = Math.max(0, subtotal - discount);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  /** static preview / server down — poora order WhatsApp par (owner usi se confirm karta hai) */
  function whatsappOrderLink(): string {
    const itemLines = lines
      .map((line) => `• ${line.title} — size ${line.size}${line.colour ? `, ${line.colour}` : ""} × ${line.quantity}`)
      .join("\n");
    const text = [
      "Hi Designer Clothing, I want to place this order:",
      "",
      itemLines,
      "",
      `Total: ${formatPrice(total)} (prepaid, UPI: ${upiId})`,
      "",
      `Name: ${form.customerName}`,
      `Phone: ${form.phone}`,
      `Email: ${form.email}`,
      `Address: ${form.address}, ${form.city}, ${form.state} — ${form.pincode}`,
      form.notes ? `Notes: ${form.notes}` : "",
      "",
      "I will share the UPI payment screenshot here.",
    ]
      .filter(Boolean)
      .join("\n");
    return `https://wa.me/91${whatsapp.replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(text)}`;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lines.length === 0) return;
    if (!pinStatus) {
      setError("Please check your delivery pincode first — we only ship to verified pincodes.");
      return;
    }
    if (!pinStatus.ok) {
      setError(pinStatus.message);
      return;
    }
    setError(null);
    setWhatsappHref(null);

    // GitHub Pages par server nahi hai — order WhatsApp par jaata hai, 404/network error nahi
    if (!API_AVAILABLE) {
      setWhatsappHref(whatsappOrderLink());
      return;
    }

    setSubmitting(true);
    try {
      // idempotency key -> double click par do order nahi bante
      const idempotencyKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;
      const result = await postJson<{ orderNumber?: string; error?: string }>(
        apiUrl("/api/orders"),
        {
          ...form,
          paymentMethod: payment,
          items: lines.map((line) => ({ handle: line.handle, size: line.size, quantity: line.quantity })),
        },
        { timeoutMs: 25_000, headers: { "Idempotency-Key": idempotencyKey } },
      );

      if (!result.data?.orderNumber) {
        setError(result.data?.error ?? result.error ?? "Order place nahi hua. Details check karke dobara try kariye.");
        setWhatsappHref(whatsappOrderLink());
        setSubmitting(false);
        return;
      }
      clear();
      router.push(`/orders/${result.data.orderNumber}`);
    } catch (error) {
      console.warn("order submit failed", error);
      setError("Order server tak nahi pahuncha. Dobara try kariye, ya WhatsApp par order bhej dijiye — wahan hum turant confirm karte hain.");
      setWhatsappHref(whatsappOrderLink());
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
            <Field
              label="Mobile number"
              required
              type="tel"
              inputMode="numeric"
              value={form.phone}
              onChange={(v) => update("phone", v)}
            />
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
            <div>
              <Field
                label="Pincode"
                required
                inputMode="numeric"
                value={form.pincode}
                onChange={(v) => update("pincode", v.replace(/\D/g, "").slice(0, 6))}
              />
              {pinBusy ? <p className="mt-1 text-[11px] text-[#8a8078]">Checking delivery…</p> : null}
              {pinStatus ? (
                <p
                  className={`mt-1 text-[11px] leading-relaxed ${pinStatus.ok ? "text-[#2f7a3f]" : "text-[#a11d1d]"}`}
                  data-testid="pincode-status"
                >
                  {pinStatus.ok
                    ? `Deliverable${pinStatus.district ? ` — ${pinStatus.district}, ${pinStatus.state}` : ""}. Free shipping, 4-7 business days.`
                    : pinStatus.message}
                </p>
              ) : null}
            </div>
            <Field label="Order notes (optional)" value={form.notes} onChange={(v) => update("notes", v)} />
          </div>
        </section>

        <section>
          <h2 className="text-[11px] font-semibold tracking-[.16em] text-[#862222] uppercase">Payment</h2>
          <div className="mt-3 border border-[#e5dbd0] bg-[#fdf8f7] p-3.5">
            <div className="flex items-start gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#862222" strokeWidth="1.7" className="mt-0.5 shrink-0" aria-hidden>
                <path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6l7-3z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              <div className="min-w-0">
                <p className="text-[12.5px] font-medium">Prepaid order — UPI (GPay, PhonePe, Paytm)</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-[#8a8078]">
                  You will get the payment page right after placing the order — scan the QR or pay to the UPI ID.
                  Payment goes straight to the store account, with no gateway charges.
                </p>
                <p className="mt-1.5 break-all text-[11.5px] font-medium text-[#862222]">UPI: {upiId}</p>
                <div className="mt-2.5">
                  <UpiApps
                    uri={buildUpiUri({
                      vpa: upiId,
                      name: upiName,
                      amountPaise: total,
                      note: "Designer Clothing order",
                    })}
                    upiId={upiId}
                    amountPaise={total}
                  />
                </div>
              </div>
            </div>
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
                  {line.size}
                  {line.colour ? ` · ${line.colour}` : ""} · Qty {line.quantity}
                </p>
                <button
                  type="button"
                  onClick={() => removeLine(line.key)}
                  data-testid="summary-remove"
                  aria-label={`Remove ${line.title} from order`}
                  className="mt-1 text-[10px] tracking-[.06em] text-[#9a8f85] uppercase underline transition hover:text-[#862222]"
                >
                  Remove
                </button>
              </div>
              <span className="text-[11.5px] font-medium">{formatPrice(line.price * line.quantity)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 space-y-2 border-t border-[#e7ddd2] pt-3 text-[12.5px]">
          <div className="flex justify-between">
            <span className="text-[#6b6259]">Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#6b6259]">Shipping</span>
            <span className="text-[#2f7a3f]">Free</span>
          </div>
          <div className="flex items-center justify-between border-t border-[#e7ddd2] pt-2.5 text-[14.5px] font-semibold">
            <span>Total</span>
            <span className="text-[#862222]">{formatPrice(total)}</span>
          </div>
        </div>

        {error ? <p className="mt-3 text-[11.5px] text-[#b3261e]">{error}</p> : null}

        {whatsappHref ? (
          <div className="mt-3 border border-[#c9dcc9] bg-[#eef7ee] p-3" data-testid="checkout-whatsapp">
            <p className="text-[11.5px] leading-relaxed text-[#2f6b3f]">
              Your order is ready — send it on WhatsApp to confirm. Pay{" "}
              <strong>{formatPrice(total)}</strong> to UPI <strong className="break-all">{upiId}</strong> and share
              the screenshot there.
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="w-[128px] shrink-0 rounded-sm border border-[#c9dcc9] bg-white p-1">
                <UpiQr
                  uri={buildUpiUri({
                    vpa: upiId,
                    name: upiName,
                    amountPaise: total,
                    note: "Designer Clothing order",
                  })}
                  alt={`UPI QR to pay ${formatPrice(total)}`}
                  className="h-auto w-full"
                  size={240}
                />
              </div>
              <div className="min-w-0 flex-1">
                <UpiApps
                  uri={buildUpiUri({
                    vpa: upiId,
                    name: upiName,
                    amountPaise: total,
                    note: "Designer Clothing order",
                  })}
                  upiId={upiId}
                  amountPaise={total}
                />
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2.5 inline-flex h-10 items-center justify-center bg-[#25D366] px-4 text-[10.5px] font-semibold tracking-[.12em] text-white uppercase"
                >
                  Send order on WhatsApp
                </a>
              </div>
            </div>
          </div>
        ) : null}

        <button
          type="submit"
          data-testid="checkout-submit"
          disabled={submitting}
          className="mt-4 w-full bg-[#862222] py-3 text-[11.5px] font-semibold tracking-[.16em] text-white uppercase disabled:opacity-60"
        >
          {submitting ? "Placing order…" : `Place order · ${formatPrice(total)}`}
        </button>
        <p className="mt-2 text-center text-[10.5px] leading-relaxed text-[#8a8078]">
          Final price is already sale price — no coupon needed. By placing this order you agree to our{" "}
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
