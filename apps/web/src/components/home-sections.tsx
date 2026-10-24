"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

type Tab = "anarkali" | "new" | "lehnga";

export function HomeSections({
  anarkali,
  newArrivals,
  lehnga,
}: {
  anarkali: ReactNode;
  newArrivals: ReactNode;
  lehnga: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("anarkali");

  const tabs: { key: Tab; label: string; subtitle: string; href: string }[] = [
    { key: "anarkali", label: "Trendy Anarkali Sets", subtitle: "Top view in this week", href: "/collections/party-wear-gown" },
    { key: "new", label: "New Arrivals", subtitle: "Freshly dropped, straight from the studio", href: "/collections/new-arrivals" },
    { key: "lehnga", label: "Lehnga Choli", subtitle: "Our Range of Designer Lehnga Choli", href: "/collections/lehnga-choli" },
  ];

  const current = tabs.find((item) => item.key === tab)!;

  return (
    <section className="container-liksha py-10 lg:py-14">
      <div className="flex flex-col items-center gap-4">
        <div className="no-scrollbar flex max-w-full items-center gap-1 overflow-x-auto border border-[#e7ddd2] bg-[#faf7f3] p-1">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`whitespace-nowrap px-3.5 py-2 text-[10.5px] font-medium tracking-[.12em] uppercase transition sm:px-5 sm:text-[11.5px] ${
                tab === item.key ? "bg-[#862222] text-white" : "text-[#5c534b] hover:text-[#862222]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="text-center">
          <h2 className="font-display text-[26px] leading-tight font-medium tracking-[.03em] text-[#2f2a25] sm:text-[32px]">
            {current.label}
          </h2>
          <p className="mt-1 text-[11.5px] tracking-[.14em] text-[#9c8f82] uppercase">{current.subtitle}</p>
        </div>
      </div>

      <div className="mt-7">
        {tab === "anarkali" ? anarkali : tab === "new" ? newArrivals : lehnga}
      </div>

      <div className="mt-8 flex justify-center">
        <Link
          href={current.href}
          className="border border-[#862222] px-9 py-3 text-[11px] font-semibold tracking-[.18em] text-[#862222] uppercase transition hover:bg-[#862222] hover:text-white"
        >
          View All
        </Link>
      </div>
    </section>
  );
}
