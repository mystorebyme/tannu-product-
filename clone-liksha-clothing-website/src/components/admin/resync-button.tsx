"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ResyncButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function resync() {
    if (!window.confirm("Re-sync the catalogue from the product data file? Existing orders are untouched.")) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/resync", { method: "POST" });
      const payload = (await response.json()) as { ok?: boolean; products?: number; error?: string };
      setNotice(
        response.ok && payload.ok
          ? `Catalogue synced — ${payload.products ?? 0} products up to date.`
          : payload.error ?? "Sync failed.",
      );
      router.refresh();
    } catch {
      setNotice("Network error while syncing.");
    }
    setBusy(false);
  }

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={resync}
        className="bg-[#862222] px-5 py-2.5 text-[10.5px] font-semibold tracking-[.14em] text-white uppercase disabled:opacity-60"
      >
        {busy ? "Syncing…" : "Re-sync catalogue"}
      </button>
      {notice ? <p className="mt-2 text-[11px] text-[#5c534b]">{notice}</p> : null}
    </div>
  );
}
