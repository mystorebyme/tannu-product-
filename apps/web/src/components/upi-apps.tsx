"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";

/**
 * UPI app shortcuts.
 *
 * Phone par "Pay with any UPI app" dabate hi OS khud saare installed UPI apps
 * (GPay, PhonePe, Paytm, BHIM, Amazon Pay, bank apps…) ka chooser dikhata hai —
 * amount aur order note pehle se bhare hote hain. Neeche har app ka direct
 * button bhi hai (jo install nahi hai wahan 1.5s me "app nahi khula" hint aata hai).
 *
 * Desktop par UPI apps nahi hote, isliye wahan sirf QR + copy UPI ID dikhta hai.
 */

type UpiApp = {
  id: string;
  label: string;
  /** Android package */
  android: string;
  /** iOS scheme (jahan app support karti hai) */
  ios?: string;
  tint: string;
  short: string;
};

const APPS: UpiApp[] = [
  { id: "gpay", label: "Google Pay", short: "G", android: "com.google.android.apps.nbu.paisa.user", ios: "gpay", tint: "#1a73e8" },
  { id: "phonepe", label: "PhonePe", short: "P", android: "com.phonepe.app", ios: "phonepe", tint: "#5f259f" },
  { id: "paytm", label: "Paytm", short: "P", android: "net.one97.paytm", ios: "paytmmp", tint: "#00b9f1" },
  { id: "bhim", label: "BHIM", short: "B", android: "in.org.npci.upiapp", ios: "bhim", tint: "#e4572e" },
  { id: "amazonpay", label: "Amazon Pay", short: "a", android: "in.amazon.mShop.android.shopping", tint: "#ff9900" },
];

function queryOf(uri: string): string {
  const index = uri.indexOf("?");
  return index === -1 ? "" : uri.slice(index + 1);
}

function linkFor(app: UpiApp, uri: string, platform: "android" | "ios" | "other"): string {
  if (platform === "android") {
    // Android intent — app install hai to seedha khulega, warna Play Store
    return `intent://pay?${queryOf(uri)}#Intent;scheme=upi;package=${app.android};S.browser_fallback_url=${encodeURIComponent(
      "https://play.google.com/store/apps/details?id=" + app.android,
    )};end`;
  }
  if (platform === "ios" && app.ios) return `${app.ios}://upi/pay?${queryOf(uri)}`;
  return uri;
}

export function UpiApps({
  uri,
  upiId,
  amountPaise,
}: {
  uri: string;
  upiId: string;
  amountPaise: number;
}) {
  const [platform, setPlatform] = useState<"android" | "ios" | "other">("other");
  const [copied, setCopied] = useState(false);
  const [appTried, setAppTried] = useState<string | null>(null);
  const [appMissed, setAppMissed] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) setPlatform("android");
    else if (/iphone|ipad|ipod/i.test(ua)) setPlatform("ios");
    else setPlatform("other");
  }, []);

  const apps = useMemo(() => APPS.map((app) => ({ ...app, href: linkFor(app, uri, platform) })), [uri, platform]);

  useEffect(() => {
    if (!appTried) return;
    setAppMissed(false);
    // app khula to tab background me chala jaata hai; nahi khula to 1.8s baad page hi visible
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") setAppMissed(true);
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [appTried]);

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
          data-testid="upi-open-any-app"
          className="inline-flex h-11 items-center justify-center bg-[#862222] px-5 text-[10.5px] font-semibold tracking-[.14em] text-white uppercase"
        >
          {platform === "other" ? "Pay with UPI app" : "Pay with any UPI app"}
        </a>
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-11 items-center justify-center border border-[#c9a95f] px-4 text-[10px] font-semibold tracking-[.1em] text-[#8a6a1f] uppercase transition hover:bg-[#f3e3bf]"
        >
          {copied ? "UPI ID copied" : "Copy UPI ID"}
        </button>
      </div>

      {platform !== "other" ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {apps.map((app) => (
            <a
              key={app.id}
              href={app.href}
              onClick={() => setAppTried(app.id)}
              rel="noreferrer"
              data-testid={`upi-app-${app.id}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#e0d5c4] bg-white px-2.5 text-[11px] font-medium text-[#3f3830] transition hover:border-[#862222]"
            >
              <span
                aria-hidden
                className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                style={{ background: app.tint }}
              >
                {app.short}
              </span>
              {app.label}
            </a>
          ))}
        </div>
      ) : null}

      <p className="mt-2 text-[11px] leading-relaxed text-[#8a7a5f]">
        {platform === "other"
          ? `QR scan karke ${formatPrice(amountPaise)} pay kariye, phir reference / UTR niche daaliye.`
          : "UPI app khul jayegi — amount pehle se bhara hoga. Pay karke wapas aaiye aur UTR daaliye."}
      </p>

      {appMissed ? (
        <p className="mt-1.5 text-[11px] leading-relaxed text-[#a11d1d]">
          Ye app install nahi lagti — upar QR scan kariye ya "Pay with any UPI app" dabaiye, ya UPI ID copy karke
          apne bank app me pay kariye.
        </p>
      ) : null}
    </div>
  );
}
