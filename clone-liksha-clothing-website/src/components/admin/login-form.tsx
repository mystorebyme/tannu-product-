"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Invalid credentials.");
        setLoading(false);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="text-[10px] tracking-[.14em] text-[#6b6259] uppercase">Username</label>
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          className="mt-1 h-11 w-full border border-[#ddd2c6] px-3 text-[13px] outline-none focus:border-[#862222]"
        />
      </div>
      <div>
        <label className="text-[10px] tracking-[.14em] text-[#6b6259] uppercase">Password</label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          className="mt-1 h-11 w-full border border-[#ddd2c6] px-3 text-[13px] outline-none focus:border-[#862222]"
        />
      </div>
      {error ? <p className="text-[11.5px] text-[#b3261e]">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#862222] py-3 text-[11px] font-semibold tracking-[.18em] text-white uppercase disabled:opacity-60"
      >
        {loading ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}
