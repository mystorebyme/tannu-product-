"use client";

import { useState } from "react";

export function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "Order enquiry", message: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("loading");
    setError(null);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Could not send your message.");
        setStatus("error");
        return;
      }
      setStatus("done");
      setForm({ name: "", email: "", phone: "", subject: "Order enquiry", message: "" });
    } catch {
      setError("Network error, please try again.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="border border-[#d6e8d9] bg-[#f2f8f3] p-6 text-center">
        <p className="font-display text-[21px] text-[#2f7a3f]">Message received!</p>
        <p className="mt-1 text-[12.5px] text-[#5c534b]">
          Our team will get back to you within 24 hours. For an instant reply, WhatsApp us on 9909790455.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="border border-[#eee6de] bg-[#faf8f5] p-5 sm:p-6">
      <h2 className="font-display text-[21px] font-medium text-[#862222]">Send us a message</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input
          required
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder="Your name *"
          className="h-11 w-full border border-[#ddd2c6] bg-white px-3 text-[13px] outline-none focus:border-[#862222]"
        />
        <input
          required
          type="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          placeholder="Email *"
          className="h-11 w-full border border-[#ddd2c6] bg-white px-3 text-[13px] outline-none focus:border-[#862222]"
        />
        <input
          value={form.phone}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
          placeholder="Phone / WhatsApp"
          className="h-11 w-full border border-[#ddd2c6] bg-white px-3 text-[13px] outline-none focus:border-[#862222]"
        />
        <select
          value={form.subject}
          onChange={(event) => setForm({ ...form, subject: event.target.value })}
          className="h-11 w-full border border-[#ddd2c6] bg-white px-3 text-[13px] outline-none focus:border-[#862222]"
        >
          {["Order enquiry", "Sizing help", "Replacement request", "Bulk / wholesale", "Other"].map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
        <textarea
          required
          rows={4}
          value={form.message}
          onChange={(event) => setForm({ ...form, message: event.target.value })}
          placeholder="How can we help? *"
          className="w-full border border-[#ddd2c6] bg-white px-3 py-2.5 text-[13px] outline-none focus:border-[#862222] sm:col-span-2"
        />
      </div>
      {error ? <p className="mt-2 text-[11.5px] text-[#b3261e]">{error}</p> : null}
      <button
        type="submit"
        disabled={status === "loading"}
        className="mt-3 bg-[#862222] px-7 py-3 text-[11px] font-semibold tracking-[.16em] text-white uppercase disabled:opacity-60"
      >
        {status === "loading" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
