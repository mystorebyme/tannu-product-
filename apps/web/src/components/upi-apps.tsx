"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";

/**
 * UPI app detection — "payment ke time saare UPI apps detect ho jaayein".
 *
 * Browser apps ko enumerate nahi kar sakta (security), isliye hum operating
 * system ka apna chooser use karte hain: `upi://pay?...` kholte hi Android/iOS
 * **installed** UPI apps dikhata hai (GPay, PhonePe, Paytm, BHIM, bank apps).
 * Upar se har popular app ka direct button bhi hai (package-specific intent),
 * taaki customer ko chunna na pade.
 *
 * Desktop par UPI apps nahi hote — wahan QR (parent component) hi chalta hai.
 */

type Platform = "android" | "ios" | "desktop";

type AppTarget = {
  id: string;
  name: string;
  short: string;
  color: string;
  /** Android package (intent me) */
  packageName: string;
  /** iOS URL scheme, jahan app support karti hai */
  iosScheme?: string;
};

const APPS: AppTarget[] = [
  { id: "gpay", name: "Google Pay", short: "G", color: "#1a73e8", packageName: "com.google.android.apps.nbu.paisa.user", iosScheme: "gpay://upi/pay" },
  { id: "phonepe", name: "PhonePe", short: "Pe", color: "#5f259f", packageName: "com.phonepe.app", iosScheme: "phonepe://pay" },
  { id: "paytm", name: "Paytm", short: "P", color: "#00b9f1", packageName: "net.one97.paytm", iosScheme: "paytmmp://pay" },
  { id: "bhim", name: "BHIM", short: "B", color: "#e07b00", packageName: "in.org.npci.upiapp", iosScheme: "upi://pay" },
  { id: "amazonpay", name: "Amazon Pay", short: "a", color: "#ff9900", packageName: "in.amazon.mShop.android.shopping", iosScheme: "amazonpay://pay" },
];

/** `upi://pay?...` ka query part (scheme hata kar) */
function queryOf(uri: string): string {
  const index = uri.indexOf("?");
  return index === -1 ? "" : uri.slice(index + 1);
}

function androidIntent(uri: string, packageName: string): string {
  return `intent://pay?${queryOf(uri)}#Intent;scheme=upi;package=${packageName};end`;
}

export function UpiApps({
  uri,
  upiId,
  amountPaise,
}: {
  /** `buildUpiUri()` ka output */
  uri: string;
  upiId: string;
  amountPaise: number;
}) {
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [copied, setCopied] = useState(false);
  const [tried, setTried] = useState<string | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) setPlatform("android");
    else if (/iphone|ipad|ipod/i.test(ua)) setPlatform("ios");
    else setPlatform("desktop");
  }, []);

  const links = useMemo(
    () =>
      APPS.map((app) => ({
        ...app,
        href:
          platform === "android"
            ? androidIntent(uri, app.packageName)
            : platform === "ios" && app.iosScheme
              ? `${app.iosScheme}?${queryOf(uri)}`
              : uri,
      })),
    [platform, uri],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(upiId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div data-testid="upi-apps">
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={uri}
          data-testid="upi-open-app"
          className="inline-flex h-10 items-center justify-center bg-[#862222] px-4 text-[10.5px] font-semibold tracking-[.14em] text-white uppercase"
        >
          {platform === "desktop" ? "Open UPI app" : "Auto-detect UPI apps"}
        </a>
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-10 items-center justify-center border border-[#ddd2c6] px-4 text-[10.5px] font-semibold tracking-[.12em] text-[#6b6259] uppercase"
        >
          {copied ? "Copied" : "Copy UPI ID"}
        </button>
      </div>

      <p className="mt-2 text-[10.5px] leading-relaxed text-[#8a8078]">
        {platform === "desktop"
          ? `Scan the QR to pay ${formatPrice(amountPaise)} — any UPI app works.`
          : `Phone par ${formatPrice(amountPaise)} ka UPI app khulega — amount pehle se bhara hoga.`}
      </p>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {links.map((app) => (
          <a
            key={app.id}
            href={app.href}
            onClick={() => setTried(app.id)}
            data-testid={`upi-app-${app.id}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#e5dbd0] bg-white px-2.5 text-[10.5px] font-medium text-[#4a423b] transition hover:border-[#862222]"
          >
            <span
              aria-hidden
              className="flex h-4 w-4 items-center justify-center rounded-full text-[8.5px] font-bold text-white"
              style={{ background: app.color }}
            >
              {app.short}
            </span>
            {app.name}
          </a>
        ))}
      </div>

      {tried ? (
        <p className="mt-2 text-[10.5px] leading-relaxed text-[#8a8078]">
          App na khule to QR scan kariye ya UPI ID copy karke apne bank app me pay kariye.
        </p>
      ) : null}
    </div>
  );
}
