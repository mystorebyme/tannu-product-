import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { emails, orderItems, orders } from "@/db/schema";
import { formatPrice } from "@/lib/format";

type OrderRow = typeof orders.$inferSelect;
type OrderItemRow = typeof orderItems.$inferSelect;

export const EMAIL_FROM =
  process.env.EMAIL_FROM || "Liksha Clothing <orders@likshaclothing.com>";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://www.likshaclothing.com";
}

function brandShell(title: string, body: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f1ec;font-family:Arial,Helvetica,sans-serif;color:#2f2a25;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f1ec;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e9dfd4;">
          <tr>
            <td style="background:#862222;padding:18px 24px;text-align:center;">
              <span style="display:inline-block;font-size:20px;letter-spacing:3px;color:#fdf3e6;text-transform:uppercase;font-weight:bold;">Liksha Clothing</span>
              <br/>
              <span style="display:inline-block;font-size:10px;letter-spacing:2px;color:#f0c98e;text-transform:uppercase;margin-top:6px;">Designer Anarkali Suits &middot; Lehengas &middot; Suit Sets</span>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 26px 8px;">
              <h1 style="margin:0;font-size:22px;letter-spacing:.5px;color:#2f2a25;">${title}</h1>
            </td>
          </tr>
          <tr><td style="padding:8px 26px 0;">${body}</td></tr>
          <tr>
            <td style="padding:26px;background:#faf6f1;border-top:1px solid #e9dfd4;text-align:center;">
              <p style="margin:0;font-size:12px;color:#6b6259;">Need help? WhatsApp us on <strong style="color:#862222;">9909790455</strong></p>
              <p style="margin:6px 0 0;font-size:12px;color:#6b6259;">Info.likshaclothing@gmail.com &middot; +91 9879219630</p>
              <p style="margin:12px 0 0;font-size:11px;color:#9c8f82;">Free shipping across India &middot; 7 days easy replacement</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function renderTrackingEmail(order: OrderRow, items: OrderItemRow[]): string {
  const eta = new Date(order.completedAt ?? order.createdAt);
  eta.setDate(eta.getDate() + 6);
  const etaLabel = eta.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const itemRows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f1ebe5;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td width="62"><img src="${siteUrl()}${item.image}" alt="" width="58" style="display:block;border:1px solid #eee6de;"/></td>
            <td style="padding-left:12px;">
              <div style="font-size:12.5px;font-weight:bold;">${item.title}</div>
              <div style="font-size:11px;color:#8a8078;margin-top:3px;">Size: ${item.size} &middot; Qty: ${item.quantity}</div>
            </td>
            <td align="right" style="font-size:12.5px;padding-left:10px;">${formatPrice(item.price * item.quantity)}</td>
          </tr></table>
        </td>
      </tr>`,
    )
    .join("");

  const body = `
    <p style="font-size:13.5px;line-height:1.7;margin:10px 0 0;">Hi ${order.customerName.split(" ")[0]},</p>
    <p style="font-size:13.5px;line-height:1.7;margin:10px 0 18px;">
      Great news — your Liksha order <strong>#${order.orderNumber}</strong> has been
      <strong style="color:#2f7a3f;">completed</strong> and is on its way to you.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6f1;border:1px solid #e9dfd4;">
      <tr>
        <td style="padding:16px 18px;">
          <div style="font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:#862222;font-weight:bold;">Tracking details</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">
            <tr>
              <td style="font-size:11px;color:#8a8078;padding:4px 0;">Courier partner</td>
              <td align="right" style="font-size:12.5px;font-weight:bold;padding:4px 0;">${order.courier ?? "BlueDart Express"}</td>
            </tr>
            <tr>
              <td style="font-size:11px;color:#8a8078;padding:4px 0;">Tracking ID</td>
              <td align="right" style="font-size:13px;font-weight:bold;letter-spacing:1.2px;color:#862222;padding:4px 0;">${order.trackingId ?? "—"}</td>
            </tr>
            <tr>
              <td style="font-size:11px;color:#8a8078;padding:4px 0;">Estimated delivery</td>
              <td align="right" style="font-size:12.5px;font-weight:bold;padding:4px 0;">${etaLabel}</td>
            </tr>
            <tr>
              <td style="font-size:11px;color:#8a8078;padding:4px 0;">Order total</td>
              <td align="right" style="font-size:12.5px;font-weight:bold;padding:4px 0;">${formatPrice(order.total)}</td>
            </tr>
          </table>
          <div style="margin-top:14px;">
            <a href="${siteUrl()}/orders/${order.orderNumber}" style="display:inline-block;background:#862222;color:#ffffff;text-decoration:none;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;font-weight:bold;padding:12px 22px;">Track your order</a>
          </div>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;">
      <tr><td style="font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:#862222;font-weight:bold;padding-bottom:6px;">Items in this order</td></tr>
      ${itemRows}
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;background:#faf6f1;">
      <tr><td style="padding:14px 16px;">
        <div style="font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:#862222;font-weight:bold;">Delivery address</div>
        <div style="font-size:12px;line-height:1.8;color:#5c534b;margin-top:8px;">
          ${order.customerName}<br/>
          ${order.address}<br/>
          ${order.city}, ${order.state} &mdash; ${order.pincode}<br/>
          ${order.phone}
        </div>
      </td></tr>
    </table>

    <p style="font-size:12px;line-height:1.8;color:#6b6259;margin:18px 0 0;">
      Your parcel is packed with love. If anything isn&apos;t perfect, simply return it within 7 days
      for an exchange &mdash; just WhatsApp us your order number.
    </p>`;

  return brandShell(`Your order is on its way 🎉`, body);
}

export function renderOrderConfirmationEmail(order: OrderRow, items: OrderItemRow[]): string {
  const itemRows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f1ebe5;font-size:12.5px;">
          ${item.title} <span style="color:#8a8078;">(${item.size} &times; ${item.quantity})</span>
          <span style="float:right;">${formatPrice(item.price * item.quantity)}</span>
        </td>
      </tr>`,
    )
    .join("");
  const body = `
    <p style="font-size:13.5px;line-height:1.7;margin:10px 0 14px;">
      Hi ${order.customerName.split(" ")[0]}, thank you for shopping with Liksha Clothing. We have received
      your order <strong>#${order.orderNumber}</strong> and will share your tracking ID as soon as it ships.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e9dfd4;">
      ${itemRows}
      <tr><td style="padding:12px 0;font-size:13px;font-weight:bold;">Total: <span style="color:#862222;">${formatPrice(order.total)}</span></td></tr>
    </table>
    <p style="font-size:12px;line-height:1.8;color:#6b6259;margin:16px 0 0;">
      Order number: <strong>${order.orderNumber}</strong> &middot; Payment: ${order.paymentMethod === "cod" ? "Cash on delivery" : "Prepaid"}
    </p>`;
  return brandShell("Order confirmed", body);
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  orderId?: number | null;
  trackingId?: string | null;
}): Promise<{ status: string; provider: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  let status = "queued";
  let provider = "outbox";
  let error: string | undefined;

  if (apiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [input.to],
          subject: input.subject,
          html: input.html,
        }),
      });
      if (response.ok) {
        status = "sent";
        provider = "resend";
      } else {
        status = "failed";
        provider = "resend";
        error = `${response.status} ${await response.text()}`.slice(0, 300);
      }
    } catch (err) {
      status = "failed";
      provider = "resend";
      error = err instanceof Error ? err.message : "send error";
    }
  }

  await db.insert(emails).values({
    orderId: input.orderId ?? null,
    toEmail: input.to,
    subject: input.subject,
    html: input.html,
    status,
    provider,
    error: error ?? null,
    trackingId: input.trackingId ?? null,
  });

  return { status, provider, error };
}

export async function sendTrackingEmail(
  order: OrderRow,
): Promise<{ status: string; provider: string; error?: string }> {
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  const html = renderTrackingEmail(order, items);
  const result = await sendEmail({
    to: order.email,
    subject: `Your Liksha order #${order.orderNumber} is on its way — Tracking ${order.trackingId ?? ""}`.trim(),
    html,
    orderId: order.id,
    trackingId: order.trackingId,
  });
  if (result.status === "sent" || result.status === "queued") {
    await db
      .update(orders)
      .set({ trackingEmailSentAt: new Date() })
      .where(eq(orders.id, order.id));
  }
  return result;
}

export async function sendOrderConfirmationEmail(order: OrderRow): Promise<{ status: string; provider: string }> {
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  return sendEmail({
    to: order.email,
    subject: `Order confirmed — #${order.orderNumber} | Liksha Clothing`,
    html: renderOrderConfirmationEmail(order, items),
    orderId: order.id,
    trackingId: order.trackingId,
  });
}

export async function getEmailHistory(limit = 50) {
  return db.select().from(emails).orderBy(desc(emails.createdAt)).limit(limit);
}
