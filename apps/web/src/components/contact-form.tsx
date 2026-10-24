"use client";

import { useState } from "react";
import { useStoreSettings } from "@/components/store-settings-provider";

/** fallback — live value Google Sheet / admin settings se aati hai */
const FALLBACK_EMAIL = "Info.likshaclothing@gmail.com";
const FALLBACK_WHATSAPP = "9909790455";

/** static mailto — koi server/API fail ho to bhi ye kaam karta hai */
function mailtoHref(
  form: { name: string; email: string; phone: string; subject: string; message: string },
  supportEmail: string,
) {
  const body = [
    `Name: ${form.name}`,
    `Email: ${form.email}`,
    form.phone ? `Phone: ${form.phone}` : "",
    "",
    form.message,
  ]
    .filter(Boolean)
    .join("\n");
  return `mailto:${supportEmail}?subject=${encodeURIComponent(`[Website] ${form.subject}`)}&body=${encodeURIComponent(body)}`;
}

export function ContactForm() {
  const { supportEmail, whatsapp } = useStoreSettings();
  const SUPPORT_EMAIL = supportEmail || FALLBACK_EMAIL;
  const SUPPORT_WHATSAPP = whatsapp || FALLBACK_WHATSAPP;
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
      <div className="border border-[#d6e8d9] bg-[#f2f8f3] p-6 text-center" data-testid="contact-success">
        <p className="font-display text-[21px] text-[#2f7a3f]">Message received!</p>
        <p className="mt-1 text-[12.5px] text-[#5c534b]">
          Our team will reply within 24 hours. For an instant reply, WhatsApp us on {SUPPORT_WHATSAPP}.
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <a
            href={`https://wa.me/91${SUPPORT_WHATSAPP}?text=${encodeURIComponent("Hi Liksha Clothing, I sent a message from the website.")}`}
            target="_blank"
            rel="noreferrer"
            className="bg-[#25d366] px-4 py-2 text-[11px] font-semibold tracking-[.12em] text-white uppercase"
          >
            WhatsApp us
          </a>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="border border-[#862222] px-4 py-2 text-[11px] font-semibold tracking-[.12em] text-[#862222] uppercase"
          >
            Email us
          </a>
        </div>
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
      {error ? (
        <p className="mt-2 text-[11.5px] text-[#b3261e]" role="alert">
          {error}{" "}
          <a href={mailtoHref(form, SUPPORT_EMAIL)} className="underline">
            Email us instead
          </a>
          .
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={status === "loading"}
          data-testid="contact-submit"
          className="bg-[#862222] px-7 py-3 text-[11px] font-semibold tracking-[.16em] text-white uppercase disabled:opacity-60"
        >
          {status === "loading" ? "Sending…" : "Send message"}
        </button>
        <a
          href={mailtoHref(form, SUPPORT_EMAIL)}
          data-testid="contact-mailto"
          className="text-[11.5px] text-[#5c534b] underline decoration-[#c9b9a8] underline-offset-4 hover:text-[#862222]"
        >
          or email {SUPPORT_EMAIL}
        </a>
      </div>
    </form>
  );
}
