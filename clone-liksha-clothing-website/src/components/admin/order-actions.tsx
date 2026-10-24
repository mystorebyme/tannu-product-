"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const STATUSES = [
  { value: "confirmed", label: "Confirmed" },
  { value: "packed", label: "Packed" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const COURIERS = ["BlueDart Express", "Delhivery", "DTDC", "Ekart Logistics", "India Post", "XpressBees", "Shadowfax"];

export function OrderActions({
  orderId,
  status,
  courier,
  trackingId,
  customerEmail,
  customerName,
  trackingEmailSentAt,
}: {
  orderId: number;
  status: string;
  courier: string;
  trackingId: string;
  customerEmail: string;
  customerName: string;
  trackingEmailSentAt: string | null;
}) {
  const router = useRouter();
  const [nextStatus, setNextStatus] = useState(status);
  const [nextCourier, setNextCourier] = useState(courier || "BlueDart Express");
  const [nextTracking, setNextTracking] = useState(trackingId);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [emailState, setEmailState] = useState<string | null>(
    trackingEmailSentAt ? `Tracking email sent on ${new Date(trackingEmailSentAt).toLocaleString("en-IN")}` : null,
  );

  async function save(options: { sendEmail?: boolean }) {
    if (!nextTracking.trim() && (nextStatus === "shipped" || nextStatus === "delivered" || nextStatus === "completed")) {
      setNotice("Add a tracking ID before marking the order as shipped or completed.");
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          courier: nextCourier,
          trackingId: nextTracking.trim().toUpperCase(),
          sendEmail: options.sendEmail ?? true,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        email?: { status: string; provider: string; error?: string };
      };
      if (!response.ok || !payload.ok) {
        setNotice(payload.error ?? "Could not update the order.");
        setBusy(false);
        return;
      }
      if (payload.email) {
        setEmailState(
          payload.email.status === "sent"
            ? `Tracking email delivered to ${customerEmail} (${payload.email.provider})`
            : payload.email.status === "queued"
              ? `Tracking email queued for ${customerEmail} (configure RESEND_API_KEY to deliver)`
              : `Email failed: ${payload.email.error ?? "unknown error"}`,
        );
      }
      setNotice("Order updated.");
      router.refresh();
    } catch {
      setNotice("Network error while updating the order.");
    }
    setBusy(false);
  }

  async function sendEmailNow() {
    if (!nextTracking.trim()) {
      setNotice("Add a tracking ID first — the email includes the tracking details.");
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingId: nextTracking.trim().toUpperCase(), courier: nextCourier }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        email?: { status: string; provider: string; error?: string };
      };
      if (!response.ok || !payload.ok) {
        setNotice(payload.error ?? "Could not send the email.");
        setBusy(false);
        return;
      }
      setEmailState(
        payload.email?.status === "sent"
          ? `Tracking email delivered to ${customerEmail} (${payload.email.provider})`
          : payload.email?.status === "queued"
            ? `Tracking email queued for ${customerEmail} (configure RESEND_API_KEY to deliver)`
            : `Email failed: ${payload.email?.error ?? "unknown error"}`,
      );
      setNotice("Email processed.");
      router.refresh();
    } catch {
      setNotice("Network error while sending the email.");
    }
    setBusy(false);
  }

  return (
    <section className="border border-[#e4d9cd] bg-white p-4">
      <h2 className="text-[11px] font-semibold tracking-[.16em] uppercase">Update order</h2>

      <div className="mt-3 space-y-3">
        <div>
          <label className="text-[10px] tracking-[.14em] text-[#6b6259] uppercase">Order status</label>
          <select
            value={nextStatus}
            onChange={(event) => setNextStatus(event.target.value)}
            className="mt-1 h-10 w-full border border-[#ddd2c6] px-2.5 text-[12px] outline-none focus:border-[#862222]"
          >
            {STATUSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] tracking-[.14em] text-[#6b6259] uppercase">Courier partner</label>
          <select
            value={nextCourier}
            onChange={(event) => setNextCourier(event.target.value)}
            className="mt-1 h-10 w-full border border-[#ddd2c6] px-2.5 text-[12px] outline-none focus:border-[#862222]"
          >
            {COURIERS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] tracking-[.14em] text-[#6b6259] uppercase">Tracking ID</label>
          <input
            value={nextTracking}
            onChange={(event) => setNextTracking(event.target.value.toUpperCase())}
            placeholder="e.g. BD123456789IN"
            className="mt-1 h-10 w-full border border-[#ddd2c6] px-2.5 text-[12px] tracking-[.06em] outline-none focus:border-[#862222]"
          />
        </div>
      </div>

      {notice ? <p className="mt-3 border border-[#eee6de] bg-[#fffaf0] px-3 py-2 text-[11px] text-[#7a5b1e]">{notice}</p> : null}
      {emailState ? (
        <p className="mt-2 border border-[#e3eddc] bg-[#f3f9f1] px-3 py-2 text-[11px] text-[#2f7a3f]">✉ {emailState}</p>
      ) : null}

      <button
        type="button"
        disabled={busy}
        onClick={() => save({ sendEmail: true })}
        className="mt-3 w-full bg-[#862222] py-3 text-[10.5px] font-semibold tracking-[.16em] text-white uppercase disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save & notify customer"}
      </button>
      <p className="mt-1.5 text-[10px] leading-relaxed text-[#9c8f82]">
        Saving with a tracking ID automatically emails {customerName.split(" ")[0]} at {customerEmail} with the
        tracking details.
      </p>

      <button
        type="button"
        disabled={busy}
        onClick={sendEmailNow}
        className="mt-2 w-full border border-[#862222] py-3 text-[10.5px] font-semibold tracking-[.16em] text-[#862222] uppercase disabled:opacity-60"
      >
        Send tracking email again
      </button>

      <a
        href={`https://wa.me/?text=${encodeURIComponent(
          nextTracking
            ? `Hi ${customerName.split(" ")[0]}, your Liksha order is on its way. Tracking ID: ${nextTracking} (${nextCourier})`
            : `Hi ${customerName.split(" ")[0]}, thank you for shopping with Liksha Clothing.`,
        )}`}
        target="_blank"
        rel="noreferrer"
        className="mt-2 block border border-[#ddd2c6] py-3 text-center text-[10.5px] font-semibold tracking-[.16em] uppercase"
      >
        Send on WhatsApp
      </a>
    </section>
  );
}
