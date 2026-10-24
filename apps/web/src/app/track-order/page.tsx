import Link from "next/link";
import type { Metadata } from "next";
import { TrackOrderForm } from "@/components/track-order-form";
import { SupportChannels } from "@/components/contact-details";

export const metadata: Metadata = {
  title: "Track your order",
  description:
    "Track your Liksha Clothing order with your order number — live status from placed to delivered, courier and AWB details.",
  alternates: { canonical: "/track-order" },
};

export default function TrackOrderPage() {
  return (
    <div>
      <div className="border-b border-[#eee6de] bg-[#faf7f3] py-10 text-center">
        <p className="text-[10.5px] tracking-[.18em] text-[#9c8f82] uppercase">Order tracking</p>
        <h1 className="mt-1.5 font-display text-[30px] font-medium tracking-[.03em] sm:text-[38px]">
          Track your order
        </h1>
        <p className="mx-auto mt-2 max-w-[560px] px-4 text-[12.5px] leading-relaxed text-[#6b6259]">
          Order number daaliye aur live status dekhiye — payment, packing, courier aur AWB sab ek jagah.
        </p>
      </div>

      <div className="container-liksha py-10">
        <div className="mx-auto max-w-[720px]">
          <div className="border border-[#eee6de] bg-[#faf8f5] p-5 sm:p-7">
            <TrackOrderForm />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="border border-[#eee6de] p-5">
              <h2 className="font-display text-[19px] font-medium text-[#862222]">Where is my order number?</h2>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[#5c534b]">
                Order confirm hone par screen par, WhatsApp par aur email me <strong>LK-…</strong> number milta
                hai. Wahi number yahan daaliye.
              </p>
            </div>
            <div className="border border-[#eee6de] p-5">
              <h2 className="font-display text-[19px] font-medium text-[#862222]">Need help?</h2>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[#5c534b]">
                Number kho gaya? WhatsApp par apna registered mobile number bhejiye — team order dhoondh kar
                status bata degi.
              </p>
              <SupportChannels className="mt-3" />
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link href="/collections/new-arrivals" className="text-[11px] font-semibold tracking-[.14em] text-[#862222] uppercase underline">
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
