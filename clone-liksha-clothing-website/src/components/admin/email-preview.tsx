"use client";

import { useState } from "react";

export function EmailPreview({ html }: { html: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="px-4 py-2">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="text-[10px] tracking-[.12em] text-[#862222] uppercase underline"
        >
          {open ? "Hide preview" : "Preview email"}
        </button>
      </div>
      {open ? (
        <div className="border-t border-[#f1ebe5] bg-[#faf8f5] p-3">
          <iframe
            title="Email preview"
            srcDoc={html}
            className="h-[520px] w-full border border-[#eee6de] bg-white"
            sandbox=""
          />
        </div>
      ) : null}
    </div>
  );
}
