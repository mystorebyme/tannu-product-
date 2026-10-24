"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MessageActions({ messageId }: { messageId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action: "read" | "unread" | "delete") {
    if (action === "delete" && !window.confirm("Delete this message?")) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/messages/${messageId}`, {
        method: action === "delete" ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: action === "delete" ? undefined : JSON.stringify({ read: action === "read" }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => act("read")}
        className="text-[10px] text-[#2f7a3f] underline disabled:opacity-50"
      >
        Mark read
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => act("delete")}
        className="text-[10px] text-[#b3261e] underline disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );
}
