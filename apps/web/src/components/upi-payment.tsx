"use client";

import { useMemo, useState } from "react";
import { postJson } from "@/lib/http-json";
import { API_AVAILABLE, apiUrl } from "@/lib/api-base";
import { formatPrice } from "@/lib/format";
import { buildUpiUri } from "@/lib/upi";
import { UpiQr } from "@/components/upi-qr";
import { UpiApps } from "@/components/upi-apps";

/**
 * UPI payment card — seedha owner ke UPI account me paisa.
 *
 * 1. Customer QR scan karta hai ya "Open UPI app" dabata hai (amount bhara hua aata hai).
 * 2. Pay karne ke baad UTR / reference daalta hai.
 * 3. Admin verify karke order confirm karta hai.
 *
 * GitHub Pages (static) par API nahi hota — wahan UTR form ki jagah WhatsApp
 * button dikhta hai, taaki customer atak na jaye.
 */
export function UpiPayment({
  orderNumber,
  amount,
  upiId,
  upiName,
  paymentStatus,
  reference,
  whatsapp,
}: {
  orderNumber: string;
  amount: number;
  upiId: string;
  upiName: string;
  paymentStatus: string;
  reference?: string | null;
  whatsapp: string;
}) {
  const [value, setValue] = useState("");
  const [last4, setLast4] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const upiUri = useMemo(
    () =>
      buildUpiUri({
        vpa: upiId,
        name: upiName,
        amountPaise: amount,
        note: `Order ${orderNumber}`,
        txnRef: orderNumber.replace(/[^A-Za-z0-9]/g, "").slice(0, 35),
      }),
    [upiId, upiName, amount, orderNumber],
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const clean = value.replace(/[\s-]/g, "").toUpperCase();
    if (!/^[A-Z0-9]{6,30}$/.test(clean)) {
      setError("Enter the UPI reference / UTR shown in your payment app (6–30 characters).");
      return;
    }
    if (!/^\d{4}$/.test(last4)) {
      setError("Enter the last 4 digits of the mobile number used for this order.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await postJson<{ ok?: boolean; error?: string }>(
      apiUrl("/api/payments/manual"),
      { orderNumber, reference: clean, phoneLast4: last4 },
      { timeoutMs: 20_000 },
    );
    if (!result.data?.ok) {
      setError(result.data?.error ?? result.error ?? "Could not save the reference. Please try again.");
      setBusy(false);
      return;
    }
    setSubmitted(true);
    setBusy(false);
  }

  const wa = whatsapp.replace(/\D/g, "").slice(-10);
  const waText = encodeURIComponent(
    `Hi Liksha Clothing, I have paid ${formatPrice(amount)} for order ${orderNumber} via UPI (${upiId}). UTR: `,
  );
  const paid = paymentStatus === "paid";

  return (
    <div className="mt-4 overflow-hidden border border-[#e6d3a8] bg-[#fdf9ee]" data-testid="upi-payment">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ecd9b0] bg-[#f8efd9] px-4 py-2.5 sm:px-5">
        <h2 className="text-[11px] font-semibold tracking-[.14em] text-[#8a6a1f] uppercase">
          {paid ? "Payment received" : `Pay ${formatPrice(amount)} via UPI`}
        </h2>
        <span className="text-[11px] text-[#8a6a1f]">Order {orderNumber}</span>
      </div>

      {paid ? (
        <div className="flex items-start gap-3 px-4 py-4 sm:px-5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e6f2e8] text-[#2f7a3f]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="m5 13 4 4L19 7" />
            </svg>
          </span>
          <p className="text-[12.5px] leading-relaxed text-[#4a423b]">
            Payment verified{reference ? ` — reference ${reference}` : ""}. Your order is confirmed and being
            prepared for dispatch.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 px-4 py-4 sm:grid-cols-[auto_1fr] sm:px-5">
          <div className="mx-auto w-full max-w-[190px] sm:mx-0">
            <div className="relative aspect-square w-full overflow-hidden rounded-sm border border-[#e6d3a8] bg-white p-1.5">
              <UpiQr
                uri={upiUri}
                alt={`UPI QR code to pay ${formatPrice(amount)} for order ${orderNumber}`}
                className="h-full w-full object-contain"
              />
            </div>
            <p className="mt-1.5 text-center text-[10px] tracking-[.08em] text-[#8a7a5f] uppercase">
              Scan with any UPI app
            </p>
          </div>

          <div className="min-w-0">
            <p className="text-[10.5px] tracking-[.12em] text-[#8a6a1f] uppercase">Pay to</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="break-all text-[14px] font-semibold text-[#5c1010]" data-testid="upi-id">
                {upiId}
              </span>
            </div>
            <p className="mt-1 break-words text-[11.5px] text-[#6b6259]">
              {upiName} · Amount <strong>{formatPrice(amount)}</strong> (exact — no extra charges)
            </p>

            <div className="mt-3">
              <UpiApps uri={upiUri} upiId={upiId} amountPaise={amount} />
            </div>

            {submitted ? (
              <div className="mt-3 border border-[#c9dcc9] bg-[#eef7ee] px-3 py-2.5" data-testid="upi-submitted">
                <p className="text-[12px] leading-relaxed text-[#2f6b3f]">
                  Payment reference received. Our team verifies it within a few minutes and confirms your
                  order on WhatsApp.
                </p>
              </div>
            ) : API_AVAILABLE ? (
              <form onSubmit={submit} className="mt-4 space-y-2.5" data-testid="upi-form">
                <p className="text-[11px] leading-relaxed text-[#6b6259]">
                  After paying, copy the reference / UTR from your UPI app and paste it here.
                </p>
                <div className="grid gap-2 sm:grid-cols-[1.4fr_0.8fr]">
                  <input
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    placeholder="UPI reference / UTR"
                    inputMode="text"
                    aria-label="UPI reference or UTR"
                    className="h-10 w-full min-w-0 border border-[#ddd2c6] bg-white px-2.5 text-[12px] outline-none focus:border-[#862222]"
                  />
                  <input
                    value={last4}
                    onChange={(event) => setLast4(event.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="Phone last 4"
                    inputMode="numeric"
                    aria-label="Last 4 digits of your mobile number"
                    className="h-10 w-full min-w-0 border border-[#ddd2c6] bg-white px-2.5 text-[12px] outline-none focus:border-[#862222]"
                  />
                </div>
                {error ? <p className="text-[11px] text-[#b3261e]">{error}</p> : null}
                <button
                  type="submit"
                  disabled={busy}
                  className="h-10 w-full bg-[#222] px-4 text-[10.5px] font-semibold tracking-[.14em] text-white uppercase disabled:opacity-60 sm:w-auto"
                >
                  {busy ? "Saving…" : "I have paid — submit reference"}
                </button>
              </form>
            ) : (
              <div className="mt-3">
                <a
                  href={`https://wa.me/91${wa}?text=${waText}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center bg-[#25D366] px-4 text-[10.5px] font-semibold tracking-[.12em] text-white uppercase"
                >
                  Send payment screenshot on WhatsApp
                </a>
                <p className="mt-1.5 text-[11px] leading-relaxed text-[#8a7a5f]">
                  Send the screenshot and our team confirms the order (you can include the UTR too).
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
