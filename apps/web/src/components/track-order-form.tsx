"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function TrackOrderForm() {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const orderNumber = value.trim().toUpperCase();
    if (!orderNumber) {
      setError("Order number daaliye (jaise LK-XXXXXXX).");
      return;
    }
    setError(null);
    router.push(`/orders/${encodeURIComponent(orderNumber)}`);
  }

  return (
    <form onSubmit={submit} className="mt-4">
      <label htmlFor="order-number" className="text-[10.5px] tracking-[.12em] text-[#6b6259] uppercase">
        Order number
      </label>
      <div className="mt-1 flex">
        <input
          id="order-number"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="LK-1A2B3C"
          className="h-11 w-full border border-[#ddd2c6] bg-white px-3 text-[13px] outline-none focus:border-[#862222]"
        />
        <button
          type="submit"
          className="shrink-0 bg-[#862222] px-5 text-[10.5px] font-semibold tracking-[.14em] text-white uppercase"
        >
          Track
        </button>
      </div>
      {error ? <p className="mt-1.5 text-[11.5px] text-[#b3261e]">{error}</p> : null}
    </form>
  );
}
