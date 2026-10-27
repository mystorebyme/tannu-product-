"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useStoreSettings } from "@/components/store-settings-provider";
import { whatsappNumber } from "@/lib/phone";

/**
 * Order page par server/DB error (Render down, Postgres unreachable) — user ko
 * generic crash ki jagah seedha WhatsApp raasta dikhta hai.
 * R45: WhatsApp number **sirf sheet se** — khaali ho to button dikhta nahi
 * (pehle yahan hardcoded number tha).
 */
export default function OrderError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { whatsapp, supportPhone } = useStoreSettings();
  const wa = whatsappNumber(whatsapp || supportPhone);
  useEffect(() => {
    console.warn("order page error", error.message);
  }, [error]);

  return (
    <div className="container-liksha py-16 lg:py-24">
      <div className="mx-auto max-w-[560px] border border-[#e9dfd4] bg-[#faf8f5] p-6 text-center sm:p-9">
        <h1 className="font-display text-[24px] font-medium">Your order could not be loaded right now</h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-[#6b6259]">
          Your order is safe — we could not connect to the order service at the moment. Please try again in a little while.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="border border-[#862222] px-6 py-3 text-[11px] font-semibold tracking-[.14em] text-[#862222] uppercase"
          >
            Try again
          </button>
          {wa ? (
            <a
              href={`https://wa.me/${wa}?text=${encodeURIComponent("Hi, my order page is not loading.")}`}
              target="_blank"
              rel="noreferrer"
              className="bg-[#25D366] px-6 py-3 text-[11px] font-semibold tracking-[.14em] text-white uppercase"
            >
              WhatsApp support
            </a>
          ) : null}
        </div>
        <p className="mt-5 text-[11.5px] text-[#8a8078]">
          <Link href="/track-order" className="text-[#862222] underline">
            Track order
          </Link>{" "}
          or the{" "}
          <Link href="/pages/contact" className="text-[#862222] underline">
            contact page
          </Link>{" "}
          can also help.
        </p>
      </div>
    </div>
  );
}
