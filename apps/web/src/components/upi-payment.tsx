"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/http-json";
import { API_AVAILABLE, apiUrl } from "@/lib/api-base";
import { formatPrice } from "@/lib/format";
import { buildUpiUri, upiAppLinks } from "@/lib/upi";
import { UpiQr } from "@/components/upi-qr";

/**
 * UPI payment card — seedha owner ke UPI account me paisa.
 *
 * 1. Order place karte hi ye page khulta hai; mobile par UPI app khud khul jaati
 *    hai (`upi://pay` intent, amount bhara hua), desktop par QR scan hota hai.
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
  returnToken,
  siteUrl,
}: {
  orderNumber: string;
  amount: number;
  upiId: string;
  upiName: string;
  paymentStatus: string;
  reference?: string | null;
  whatsapp: string;
  /** UPI return callback ka signed token (server par banta hai) */
  returnToken?: string;
  /** apni site ka URL — callback isi par wapas aata hai */
  siteUrl?: string;
}) {
  const [value, setValue] = useState("");
  const [last4, setLast4] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [autoChecked, setAutoChecked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const router = useRouter();
  const autoRan = useRef(false);
  const appOpened = useRef(false);

  const callbackUrl = useMemo(() => {
    if (!returnToken) return undefined;
    const base = (siteUrl ?? (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/+$/, "");
    if (!base) return undefined;
    return `${base}/orders/${encodeURIComponent(orderNumber)}?${new URLSearchParams({ upi: "return", t: returnToken })}`;
  }, [orderNumber, returnToken, siteUrl]);

  /**
   * UPI app se wapas aane par (deep link ka `url` callback) order **auto-confirm**.
   * Server token verify karta hai; owner admin panel se undo kar sakta hai.
   */
  useEffect(() => {
    if (autoRan.current || paymentStatus === "paid" || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("upi") !== "return") return;
    const token = params.get("t") ?? returnToken;
    if (!token) return;
    autoRan.current = true;
    void (async () => {
      const result = await postJson<{ ok?: boolean; alreadyPaid?: boolean }>(
        apiUrl("/api/payments/return"),
        { orderNumber, token, search: window.location.search },
        { timeoutMs: 20_000 },
      );
      setAutoChecked(true);
      if (result.data?.ok) {
        const url = new URL(window.location.href);
        url.searchParams.delete("upi");
        url.searchParams.delete("t");
        window.history.replaceState({}, "", url.toString());
        router.refresh();
      }
    })();
  }, [orderNumber, paymentStatus, returnToken, router]);

  const upiUri = useMemo(
    () =>
      buildUpiUri({
        vpa: upiId,
        name: upiName,
        amountPaise: amount,
        note: `Order ${orderNumber}`,
        txnRef: orderNumber.replace(/[^A-Za-z0-9]/g, "").slice(0, 35),
        callbackUrl,
      }),
    [upiId, upiName, amount, orderNumber, callbackUrl],
  );

  /** phone ke saare UPI apps — amount + order note pehle se bhara hua */
  const appLinks = useMemo(() => upiAppLinks(upiUri), [upiUri]);

  async function copyUpiId() {
    try {
      await navigator.clipboard.writeText(upiId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  /** status dobara check karo (UPI app se wapas aane par turant) */
  async function recheckStatus() {
    setStatusNote("Checking payment status…");
    try {
      const response = await fetch(apiUrl(`/api/orders/${encodeURIComponent(orderNumber)}/payment`), {
        cache: "no-store",
      });
      const payload = (await response.json()) as { paymentStatus?: string };
      const status = payload?.paymentStatus ?? "pending";
      setStatusNote(
        status === "paid"
          ? "Payment confirmed — order confirm ho gaya."
          : status === "processing"
            ? "Reference mil gaya — team verify kar rahi hai."
            : status === "failed"
              ? "Payment failed dikh rahi hai — dobara try kariye."
              : "Abhi tak payment pending hai.",
      );
      router.refresh();
    } catch {
      setStatusNote("Status check nahi ho paaya — thodi der baad try kariye.");
    }
  }

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

  /** UPI app me payment fail hui — order par failed mark + owner ki sheet me row */
  async function reportFailed() {
    if (!/^\d{4}$/.test(last4)) {
      setError("Payment fail hui? Neeche apne mobile number ke last 4 digit daaliye.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await postJson<{ ok?: boolean; error?: string }>(
      apiUrl("/api/payments/failed"),
      { orderNumber, phoneLast4: last4, reason: "Customer reported UPI failure" },
      { timeoutMs: 15_000 },
    );
    setBusy(false);
    if (!result.data?.ok) {
      setError(result.data?.error ?? result.error ?? "Report save nahi hua — WhatsApp par bata dijiye.");
      return;
    }
    setFailed(true);
  }

  const wa = whatsapp.replace(/\D/g, "").slice(-10);
  const waText = encodeURIComponent(
    `Hi Designer Clothing, I have paid ${formatPrice(amount)} for order ${orderNumber} via UPI (${upiId}). UTR: `,
  );
  const paid = paymentStatus === "paid";

  /**
   * "Place order" ke turant baad payment page: mobile par pehli baar apne aap
   * UPI app (chooser) khulti hai. Browser gesture ke bina bhi intent usually
   * chalta hai; na chale to QR/UPI ID neeche maujood hai.
   */
  useEffect(() => {
    if (appOpened.current || typeof window === "undefined" || paid) return;
    if (new URLSearchParams(window.location.search).get("pay") !== "1") return;
    if (!/android|iphone|ipad|ipod/i.test(navigator.userAgent)) return;
    appOpened.current = true;
    const timer = window.setTimeout(() => {
      window.location.href = upiUri;
    }, 600);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



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

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copyUpiId}
                className="inline-flex h-8 items-center border border-[#e0cf9f] bg-white px-2.5 text-[10px] font-semibold tracking-[.08em] text-[#6b5214] uppercase"
                data-testid="upi-copy"
              >
                {copied ? "UPI ID copied" : "Copy UPI ID"}
              </button>
              <button
                type="button"
                onClick={recheckStatus}
                className="inline-flex h-8 items-center border border-[#e0cf9f] bg-white px-2.5 text-[10px] font-semibold tracking-[.08em] text-[#6b5214] uppercase"
                data-testid="upi-recheck"
              >
                Check status
              </button>
            </div>

            {/* phone ke saare UPI apps — ek tap me app khulti hai, amount + note bhara hua */}
            <div className="mt-3" data-testid="upi-apps">
              <p className="text-[10.5px] tracking-[.12em] text-[#8a6a1f] uppercase">Pay with any UPI app</p>
              <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {appLinks.map((app) => (
                  <a
                    key={app.id}
                    href={app.href}
                    data-testid={`upi-app-${app.id}`}
                    className="inline-flex h-9 items-center justify-center border border-[#e0cf9f] bg-white px-2 text-center text-[10px] font-semibold tracking-[.04em] text-[#5c4a16] uppercase transition hover:border-[#8a6a1f] hover:bg-[#fffaf0]"
                  >
                    {app.label}
                  </a>
                ))}
              </div>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-[#8a7a5f]">
                Mobile par tap kariye — app khud khulegi, amount aur order number already bhara hoga.
                Laptop par neeche QR scan kariye.
              </p>
            </div>

            {statusNote ? (
              <p className="mt-2 border border-[#e6d3a8] bg-[#fbf3df] px-2.5 py-2 text-[11px] leading-relaxed text-[#7a5c14]">
                {statusNote}
              </p>
            ) : null}

            {autoChecked && paymentStatus !== "paid" ? (
              <p className="mt-2 border border-[#e6d3a8] bg-[#fbf3df] px-2.5 py-2 text-[11px] leading-relaxed text-[#7a5c14]">
                UPI app se confirmation nahi mila. Neeche reference (UTR) daal dijiye ya WhatsApp par screenshot
                bhej dijiye — team turant verify karegi.
              </p>
            ) : null}

            <p className="mt-2 text-[11px] leading-relaxed text-[#8a7a5f]">
              Mobile par UPI app khud khul jaati hai. Na khule to is page ko refresh karein ya QR scan
              karein — UPI ID par bhi pay kar sakte hain.
            </p>

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
                {failed ? (
                  <p className="text-[11px] text-[#8a6a1f]">
                    Payment failed mark ho gayi — dobara UPI app se try kariye, ya WhatsApp par order confirm kar
                    dijiye.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={reportFailed}
                    disabled={busy}
                    className="text-[10.5px] tracking-[.08em] text-[#8a7a5f] uppercase underline"
                  >
                    Payment fail ho gayi? Report kariye
                  </button>
                )}
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
