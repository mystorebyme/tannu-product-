/**
 * Payment provider adapter.
 * Abhi third-party (Razorpay Payment Link / hosted checkout) hi use karte hain —
 * apna gateway ya card data kabhi handle nahi karte (PCI scope zero).
 */
import type { Order } from "@liksha/types";

export type PaymentInitiation =
  | { mode: "redirect"; url: string; provider: "razorpay" }
  | { mode: "manual"; upiId: string; message: string; provider: "manual" };

const UPI_ID = process.env.NEXT_PUBLIC_UPI_ID ?? "likshaclothing@upi";

export async function createPaymentLink(order: Order): Promise<PaymentInitiation> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return {
      mode: "manual",
      provider: "manual",
      upiId: UPI_ID,
      message:
        "Prepaid orders ke liye payment link WhatsApp par 10 minute me bhej diya jata hai. Aap UPI se bhi pay kar sakte hain.",
    };
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
    body: JSON.stringify({
      amount: order.total,
      currency: "INR",
      accept_partial: false,
      reference_id: order.orderNumber,
      description: `Liksha Clothing order ${order.orderNumber}`,
      customer: { name: order.customerName, email: order.email, contact: `+91${order.phone}` },
      notify: { sms: true, email: true },
      reminder_enable: true,
      notes: { orderNumber: order.orderNumber },
      callback_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.likshaclothing.com"}/orders/${order.orderNumber}`,
      callback_method: "get",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("razorpay payment link failed", response.status, detail);
    throw new Error("Payment link banane me problem aayi. Please try again.");
  }

  const payload = (await response.json()) as { short_url?: string };
  if (!payload.short_url) throw new Error("Payment link missing in provider response.");
  return { mode: "redirect", provider: "razorpay", url: payload.short_url };
}
