"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type CollectionRow = {
  id: number;
  handle: string;
  title: string;
  subtitle: string;
  image: string;
  sortOrder: number;
};

export function CollectionsEditor({ collections }: { collections: CollectionRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(collections);
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function update(id: number, patch: Partial<CollectionRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  async function save(row: CollectionRow) {
    setBusy(row.id);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/collections/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      });
      const payload = (await response.json()) as { error?: string };
      setNotice(response.ok ? "Collection saved." : payload.error ?? "Could not save.");
      router.refresh();
    } catch {
      setNotice("Network error while saving.");
    }
    setBusy(null);
  }

  return (
    <div>
      {notice ? (
        <p className="mb-3 border border-[#e4d9cd] bg-[#fffaf0] px-3 py-2 text-[11px] text-[#7a5b1e]">{notice}</p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((row) => (
          <div key={row.id} className="border border-[#e4d9cd] bg-white p-4">
            <div className="flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={row.image} alt="" className="h-20 w-16 border border-[#eee6de] object-cover" />
              <div className="flex-1">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="text-[9.5px] tracking-[.12em] text-[#6b6259] uppercase">Title</label>
                    <input
                      value={row.title}
                      onChange={(event) => update(row.id, { title: event.target.value })}
                      className="mt-1 h-9 w-full border border-[#ddd2c6] px-2.5 text-[11.5px] outline-none focus:border-[#862222]"
                    />
                  </div>
                  <div>
                    <label className="text-[9.5px] tracking-[.12em] text-[#6b6259] uppercase">Handle</label>
                    <input
                      value={row.handle}
                      readOnly
                      className="mt-1 h-9 w-full border border-[#eee6de] bg-[#faf8f5] px-2.5 text-[11.5px] text-[#8a8078]"
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <label className="text-[9.5px] tracking-[.12em] text-[#6b6259] uppercase">Subtitle</label>
                  <input
                    value={row.subtitle}
                    onChange={(event) => update(row.id, { subtitle: event.target.value })}
                    className="mt-1 h-9 w-full border border-[#ddd2c6] px-2.5 text-[11.5px] outline-none focus:border-[#862222]"
                  />
                </div>
                <div className="mt-2">
                  <label className="text-[9.5px] tracking-[.12em] text-[#6b6259] uppercase">Image URL</label>
                  <input
                    value={row.image}
                    onChange={(event) => update(row.id, { image: event.target.value })}
                    className="mt-1 h-9 w-full border border-[#ddd2c6] px-2.5 text-[10.5px] outline-none focus:border-[#862222]"
                  />
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="text-[9.5px] tracking-[.12em] text-[#6b6259] uppercase">Sort</label>
                <input
                  type="number"
                  value={row.sortOrder}
                  onChange={(event) => update(row.id, { sortOrder: Number(event.target.value) })}
                  className="h-9 w-16 border border-[#ddd2c6] px-2 text-[11.5px] outline-none"
                />
                <a
                  href={`/collections/${row.handle}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-[#862222] underline"
                >
                  View
                </a>
              </div>
              <button
                type="button"
                disabled={busy === row.id}
                onClick={() => save(row)}
                className="bg-[#862222] px-5 py-2.5 text-[10px] font-semibold tracking-[.14em] text-white uppercase disabled:opacity-60"
              >
                {busy === row.id ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
