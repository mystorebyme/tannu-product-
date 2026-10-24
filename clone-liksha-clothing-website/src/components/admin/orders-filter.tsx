"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const statuses = [
  { value: "", label: "All orders" },
  { value: "confirmed", label: "Confirmed" },
  { value: "packed", label: "Packed" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export function OrdersFilter({ status, query }: { status: string; query: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(query);

  function apply(nextStatus: string, nextQuery: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextStatus) params.set("status", nextStatus);
    else params.delete("status");
    if (nextQuery) params.set("q", nextQuery);
    else params.delete("q");
    const qs = params.toString();
    router.push(qs ? `/admin/orders?${qs}` : "/admin/orders", { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border border-[#e4d9cd] bg-white p-3">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          apply(status, value);
        }}
        className="flex flex-1 items-center gap-2"
      >
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search order no., customer, phone, tracking ID…"
          className="h-10 min-w-[200px] flex-1 border border-[#e0d6ca] px-3 text-[12px] outline-none focus:border-[#862222]"
        />
        <button type="submit" className="h-10 border border-[#862222] px-4 text-[10.5px] font-semibold tracking-[.14em] text-[#862222] uppercase">
          Search
        </button>
      </form>
      <div className="flex flex-wrap gap-1.5">
        {statuses.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => apply(item.value, value)}
            className={`border px-3 py-2 text-[10.5px] ${
              status === item.value ? "border-[#862222] bg-[#862222] text-white" : "border-[#e0d6ca] text-[#5c534b]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
