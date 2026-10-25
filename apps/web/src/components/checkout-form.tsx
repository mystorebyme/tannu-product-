"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/cart-provider";
import { formatPrice, imageUrl } from "@/lib/format";
import { SafeImage } from "@/components/safe-image";
import { useStoreSettings } from "@/components/store-settings-provider";
import { API_AVAILABLE, LIVE_STORE_URL, apiUrl } from "@/lib/api-base";
import { postJson, readJson } from "@/lib/http-json";
import { checkPincodeOffline } from "@/lib/pincode-offline";
import { INDIAN_STATES, canonicalStateName, statesMatch } from "@/lib/state-match";

const indianStates = INDIAN_STATES;

export function CheckoutForm() {
  const { lines, subtotal, count, clear, isOpen, closeCart, removeLine } = useCart();
  const router = useRouter();
  // festive sale me final price already 499–699 hai — koi extra coupon nahi
  const { whatsapp } = useStoreSettings();
  /**
   * Sirf tab set hota hai jab order **server par save na ho** (static preview ya
   * network/API fail). Checkout par UPI ID / QR / "pay here" **kabhi nahi** —
   * payment sirf step 3 (payment page) par. Ye block sirf help ke liye hai.
   */
  const [fallbackHref, setFallbackHref] = useState<string | null>(null);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  // sirf prepaid — COD option hata diya gaya hai
  const payment = "prepaid" as const;
  const [submitting, setSubmitting] = useState(false);
  /**
   * 3-step checkout (owner request): 1) delivery details → 2) review → 3) payment
   * page (alag URL). Address aur payment kabhi ek hi screen par nahi aate.
   */
  const [step, setStep] = useState<"details" | "review">("details");
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

  /** customer checkout tak pahuncha — ek hi baar log hota hai */
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current || lines.length === 0) return;
    startedRef.current = true;
    trackCheckout("checkout.started");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.length]);

  const discount = 0;
  const total = Math.max(0, subtotal - discount);

  /**
   * Owner rule: pincode jis state ka hai, wahi state select hona chahiye.
   * Mismatch par aage nahi jaane dete aur sahi state ek tap me set ho jaati hai.
   */
  const pinState = canonicalStateName(pinStatus?.state) ?? pinStatus?.state ?? null;
  const stateMismatch = Boolean(pinStatus?.ok && pinState && !statesMatch(form.state, pinState));

  /** Step 1 → Step 2: delivery details theek hon tabhi aage */
  function goToReview() {
    const missing =
      form.customerName.trim().length < 2
        ? "Poora naam likhiye."
        : !/^\S+@\S+\.\S+$/.test(form.email.trim())
          ? "Email theek likhiye — invoice/update isi par aata hai."
          : form.phone.replace(/\D/g, "").length !== 10
            ? "10 digit ka mobile number daaliye."
            : form.address.trim().length < 8
              ? "Poora address likhiye (house, street, area)."
              : form.city.trim().length < 2
                ? "City likhiye."
                : form.pincode.length !== 6
                  ? "6 digit pincode daaliye."
                  : !pinStatus
                    ? "Pincode check hone dein — delivery availability verify ho rahi hai."
                    : !pinStatus.ok
                      ? pinStatus.message
                      : stateMismatch
                        ? `Ye pincode ${pinState} ka hai — State me "${pinState}" select kariye (abhi "${form.state}" chuna hua hai).`
                        : null;
    if (missing) {
      setError(missing);
      return;
    }
    setError(null);
    setStep("review");
    trackCheckout("checkout.review");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  /**
   * Checkout funnel — har stage DB me (`checkout_events`) aur owner ki Google
   * Sheet me (Checkout tab) jaata hai: checkout tak pahuncha, review tak aaya,
   * order place hua, ya fail hua. Isse owner ko pata rahe kahan log ruk rahe hain.
   */
  function trackCheckout(event: string, extra: Record<string, unknown> = {}) {
    if (!API_AVAILABLE) return;
    void fetch(apiUrl("/api/checkout/events"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        event,
        step,
        items: lines.map((line) => ({ handle: line.handle, size: line.size, quantity: line.quantity })),
        subtotal,
        ...extra,
      }),
    }).catch(() => {});
  }

  /** static preview par order save nahi hota — live store par bhejte hain */
  function liveStoreCheckoutUrl() {
    return `${LIVE_STORE_URL.replace(/\/+$/, "")}/checkout`;
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
      `Total: ${formatPrice(total)} (prepaid)`,
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
    setFallbackHref(null);
    setFallbackReason(null);

    /**
     * GitHub Pages (static preview) par koi server nahi hota — wahan order save
     * nahi ho sakta. Customer ko clearly batate hain aur live store par bhejte
     * hain (payment wahan step 3 par hi khulta hai).
     */
    if (!API_AVAILABLE) {
      setFallbackReason("preview");
      setFallbackHref(liveStoreCheckoutUrl());
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
        const message =
          result.data?.error ?? result.error ?? "Order place nahi hua. Details check karke dobara try kariye.";
        setError(message);
        setFallbackReason("failed");
        setFallbackHref(whatsappOrderLink());
        trackCheckout("order.failed", { reason: message });
        setSubmitting(false);
        return;
      }
      trackCheckout("order.placed", { orderNumber: result.data.orderNumber, total });
      clear();
      /**
       * Payment **step 3** = alag page. `?pay=1` se mobile par UPI app chooser
       * khud khulta hai (QR/UPI ID wahan hai, checkout par kabhi nahi).
       */
      router.push(`/orders/${encodeURIComponent(result.data.orderNumber)}/pay?pay=1`);
    } catch (error) {
      console.warn("order submit failed", error);
      setError("Order server tak nahi pahuncha. Dobara try kariye, ya WhatsApp par order bhej dijiye — wahan hum turant confirm karte hain.");
      setFallbackReason("failed");
      setFallbackHref(whatsappOrderLink());
      trackCheckout("order.failed", { reason: (error as Error)?.message ?? "network" });
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
        {/* 3-step indicator — payment apne page par (step 3) */}
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] tracking-[.14em] uppercase" data-testid="checkout-steps">
          {[
            { n: 1, label: "Delivery", active: step === "details", href: null },
            { n: 2, label: "Review", active: step === "review", href: null },
            { n: 3, label: "Payment", active: false, href: null },
          ].map((item, index) => (
            <li key={item.n} className="flex items-center gap-2">
              {index > 0 ? <span className="text-[#c9bfb4]">→</span> : null}
              <span
                className={
                  item.active
                    ? "bg-[#862222] px-2.5 py-1 text-white"
                    : "border border-[#e0d6ca] px-2.5 py-1 text-[#9a8f85]"
                }
              >
                {item.n} · {item.label}
              </span>
            </li>
          ))}
        </ol>

        {step === "details" ? (
        <>
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
              {/*
                Owner rule: pincode aur state match hone chahiye. Mismatch par
                saaf message + ek tap me sahi state set (aage jaana block rehta hai).
              */}
              {stateMismatch ? (
                <div
                  className="mt-1.5 border border-[#e6c9a8] bg-[#fdf6ea] px-2.5 py-2"
                  data-testid="state-mismatch"
                  role="alert"
                >
                  <p className="text-[11px] leading-relaxed text-[#8a5a14]">
                    Ye pincode <strong>{pinState}</strong> ka hai, par State me{" "}
                    <strong>{form.state}</strong> chuna hua hai. State badal kar {pinState} kariye.
                  </p>
                  <button
                    type="button"
                    onClick={() => update("state", pinState ?? form.state)}
                    className="mt-1.5 inline-flex h-7 items-center border border-[#8a5a14] bg-white px-2.5 text-[10px] font-semibold tracking-[.08em] text-[#8a5a14] uppercase"
                    data-testid="state-fix"
                  >
                    State {pinState} set kariye
                  </button>
                </div>
              ) : null}
            </div>
            <Field label="Order notes (optional)" value={form.notes} onChange={(v) => update("notes", v)} />
          </div>
        </section>

        <section>
          <h2 className="text-[11px] font-semibold tracking-[.16em] text-[#862222] uppercase">Payment</h2>
          {/* Payment ki poori detail order page par — order place hote hi wahi khulta hai.
              Yahan sirf itna ki prepaid hai, taaki checkout lamba na ho. */}
          <div className="mt-3 flex items-start gap-3 border border-[#e5dbd0] bg-[#fdf8f7] p-3.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#862222" strokeWidth="1.7" className="mt-0.5 shrink-0" aria-hidden>
              <path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 7.6S5 16.2 5 12V6l7-3z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <p className="text-[12.5px] leading-relaxed text-[#4a423b]" data-testid="prepaid-note">
              Prepaid order. Order place karte hi payment ka alag page khulega — payment wahan
              karni hai. Payment seedha store account me jaata hai, koi gateway charge nahi.
            </p>
          </div>
        </section>
        </>
        ) : (
          <>
            {/* Step 2 — review. Yahan koi input nahi, sirf confirm (payment next page). */}
            <section data-testid="checkout-review">
              <h2 className="text-[11px] font-semibold tracking-[.16em] text-[#862222] uppercase">
                Review your order
              </h2>
              <div className="mt-3 border border-[#eee6de] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10.5px] tracking-[.12em] text-[#9a8f85] uppercase">Deliver to</p>
                    <p className="mt-1 text-[13px] font-medium text-[#2f2a25]">{form.customerName}</p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-[#5c534b]">
                      {form.address}, {form.city}, {form.state} — {form.pincode}
                    </p>
                    <p className="mt-1 text-[12px] text-[#5c534b]">
                      {form.phone} · {form.email}
                    </p>
                    {form.notes ? (
                      <p className="mt-1 text-[11.5px] text-[#8a8078]">Note: {form.notes}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep("details")}
                    className="shrink-0 border border-[#862222] px-3 py-1.5 text-[10px] font-semibold tracking-[.12em] text-[#862222] uppercase"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-[11px] font-semibold tracking-[.16em] text-[#862222] uppercase">
                Items ({count})
              </h2>
              <ul className="mt-3 divide-y divide-[#eee6de] border border-[#eee6de] bg-white">
                {lines.map((line) => (
                  <li key={line.key} className="flex gap-3 p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <SafeImage src={imageUrl(line.image, 160)} alt={line.title} className="h-16 w-12 shrink-0 object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[12px] leading-snug">{line.title}</p>
                      <p className="mt-0.5 text-[11px] text-[#8a8078]">
                        Size {line.size}
                        {line.colour ? ` · ${line.colour}` : ""} · Qty {line.quantity}
                      </p>
                    </div>
                    <span className="text-[12px] font-medium">{formatPrice(line.price * line.quantity)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-[11px] font-semibold tracking-[.16em] text-[#862222] uppercase">Payment</h2>
              <div className="mt-3 flex items-start gap-3 border border-[#e5dbd0] bg-[#fdf8f7] p-3.5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#862222" strokeWidth="1.7" className="mt-0.5 shrink-0" aria-hidden>
                  <path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 7.6S5 16.2 5 12V6l7-3z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
                <p className="text-[12.5px] leading-relaxed text-[#4a423b]" data-testid="prepaid-note">
                  Prepaid order. <strong>Place order</strong> dabate hi order number banega aur payment ka
                  alag page khulega. Payment confirm hone par hi order confirm hoga.
                </p>
              </div>
            </section>
          </>
        )}
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

        {/*
          Fallback only — customer ko checkout par UPI ID / QR / "pay here" kabhi
          nahi dikhta (owner rule: payment sirf 3rd step par). Yahan sirf itna ki
          order save nahi hua to kya karein.
        */}
        {fallbackHref ? (
          <div
            className="mt-3 border border-[#e7ddd2] bg-white p-3"
            data-testid="checkout-fallback"
          >
            {fallbackReason === "preview" ? (
              <p className="text-[11.5px] leading-relaxed text-[#6b6259]">
                Ye static preview hai — yahan se order save nahi hota. Live store par order kariye;
                payment ka page wahan agle step par khulega.
              </p>
            ) : (
              <p className="text-[11.5px] leading-relaxed text-[#6b6259]">
                Order server par save nahi hua. <strong>Dobara try</strong> kariye — ya WhatsApp par
                order bhej dijiye, team turant confirm karegi.
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {fallbackReason === "preview" ? (
                <a
                  href={fallbackHref}
                  className="inline-flex h-9 items-center bg-[#862222] px-3 text-[10px] font-semibold tracking-[.12em] text-white uppercase"
                >
                  Live store par order kariye
                </a>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setFallbackHref(null)}
                    className="inline-flex h-9 items-center border border-[#862222] px-3 text-[10px] font-semibold tracking-[.12em] text-[#862222] uppercase"
                  >
                    Try again
                  </button>
                  <a
                    href={fallbackHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center bg-[#25D366] px-3 text-[10px] font-semibold tracking-[.12em] text-white uppercase"
                  >
                    WhatsApp par bhejein
                  </a>
                </>
              )}
            </div>
          </div>
        ) : null}

        {step === "details" ? (
          <button
            type="button"
            onClick={goToReview}
            data-testid="checkout-continue"
            className="mt-4 w-full bg-[#862222] py-3 text-[11.5px] font-semibold tracking-[.16em] text-white uppercase"
          >
            Continue to review
          </button>
        ) : (
          <>
            <button
              type="submit"
              data-testid="checkout-submit"
              disabled={submitting}
              className="mt-4 w-full bg-[#862222] py-3 text-[11.5px] font-semibold tracking-[.16em] text-white uppercase disabled:opacity-60"
            >
              {submitting ? "Placing order…" : `Place order & pay · ${formatPrice(total)}`}
            </button>
            <button
              type="button"
              onClick={() => setStep("details")}
              className="mt-2 w-full border border-[#ddd2c6] py-2.5 text-[10.5px] font-semibold tracking-[.14em] text-[#6b6259] uppercase"
            >
              ← Edit delivery details
            </button>
          </>
        )}
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
