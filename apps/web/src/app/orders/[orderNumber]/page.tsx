import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getOrder } from "@/lib/orders";
import { formatDate, formatPrice, imageUrl } from "@/lib/format";
import { ORDER_STATUS_COPY, siteConfig } from "@/config/site";
import { SafeImage } from "@/components/safe-image";
import { orderWhatsAppLink } from "@/lib/whatsapp";
import { getStoreSettings } from "@/lib/store-settings";
import { PaymentStatusWatcher } from "@/components/payment-status-watcher";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Order confirmed", robots: { index: false } };

export default async function OrderPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const order = await getOrder(orderNumber);
  const settings = await getStoreSettings();
  const headerList = await headers();
  const fallbackHost = new URL(siteConfig.url).host;
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? fallbackHost;
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const siteUrl = `${proto}://${host}`;
  if (!order) notFound();

  const eta = new Date(order.createdAt);
  eta.setDate(eta.getDate() + 6);
  const etaLabel = eta.toLocaleDateString("en-IN", { day: "numeric", month: "long" });
  const timeline = ["placed", "confirmed", "packed", "shipped", "delivered"] as const;
  const currentStep = timeline.indexOf(order.status as (typeof timeline)[number]);

  return (
    <div className="container-liksha py-10 lg:py-14">
      <div className="mx-auto max-w-[860px]">
        <div className="border border-[#e9dfd4] bg-[#faf8f5] p-6 text-center sm:p-9">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e6f2e8] text-[#2f7a3f]">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="m5 13 4 4L19 7" />
            </svg>
          </span>
          <h1 className="mt-4 font-display text-[27px] font-medium sm:text-[32px]">
            Thank you, {order.customerName.split(" ")[0]}!
          </h1>
          <p className="mt-1.5 text-[12.5px] text-[#6b6259]">
            {order.paymentMethod === "cod"
              ? "Your order is confirmed. Please pay the COD amount at delivery."
              : order.paymentStatus === "paid"
                ? "Payment received — thank you! Your order is confirmed and being prepared for dispatch."
                : order.paymentStatus === "processing"
                  ? "Payment reference received — our team is verifying it. Order confirm hote hi aapko update milega."
                  : order.paymentStatus === "failed"
                    ? "Payment fail hui thi. Neeche se dobara payment kar sakte hain."
                    : "Order reserved hai. Payment complete karte hi order confirm ho jayega."}
          </p>
          <a
            href={orderWhatsAppLink(order, siteUrl)}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="confirm-whatsapp"
            className="mt-4 inline-flex items-center gap-2 bg-[#25D366] px-6 py-3 text-[11px] font-semibold tracking-[.14em] text-white uppercase transition hover:bg-[#1eb457]"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.2 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .1-1.6-.1a11.6 11.6 0 0 1-5.9-5.2c-.4-.7-.6-1.4-.6-2 0-.6.3-1.2.6-1.6.2-.2.4-.3.6-.3h.5c.2 0 .4 0 .5.4l.7 1.7c.1.2 0 .4-.1.6l-.4.5c-.1.1-.2.3-.1.5a7.5 7.5 0 0 0 3.3 2.9c.2.1.4.1.5-.1l.6-.7c.2-.2.3-.2.5-.1l1.6.8c.2.1.4.2.4.4 0 .2 0 .9-.2 1.4Z" />
            </svg>
            Confirm order on WhatsApp
          </a>
          <p className="mt-1.5 text-[11px] text-[#8a8078]">
            This button sends your order number, every item with size and quantity, and the total on WhatsApp.
          </p>

          <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-[#e9dfd4] pt-4 text-[12px]">
            <span>
              Order:{" "}
              <strong data-testid="order-number" className="text-[#862222]">
                {order.orderNumber}
              </strong>
            </span>
            <span>Estimated delivery: <strong>{etaLabel}</strong></span>
            <span>Placed: <strong>{formatDate(order.createdAt)}</strong></span>
          </div>
        </div>

        {/* Payment alag page par hota hai — yahan sirf uska live status */}
        {order.paymentMethod !== "cod" ? (
          <div className="mt-4" data-testid="order-payment-block">
            <PaymentStatusWatcher orderNumber={order.orderNumber} initialStatus={order.paymentStatus} />
            {order.paymentStatus !== "paid" ? (
              <div className="mt-3 flex flex-wrap items-center gap-3 border border-[#e9dfd4] bg-white px-4 py-3">
                <Link
                  href={`/orders/${order.orderNumber}/pay`}
                  data-testid="complete-payment"
                  className="bg-[#862222] px-5 py-2.5 text-[11px] font-semibold tracking-[.14em] text-white uppercase"
                >
                  {order.paymentStatus === "failed" ? "Retry payment" : "Complete payment"}
                </Link>
                <p className="text-[11.5px] text-[#6b6259]">
                  {formatPrice(order.total)} · UPI ({settings.upiName}) — paisa milne par order confirm hoga.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 border border-[#eee6de] p-5" data-testid="order-tracking">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[11px] font-semibold tracking-[.16em] uppercase">Order tracking</h2>
            <span className="text-[11px] text-[#8a8078]">
              Status: <strong className="text-[#862222]">{ORDER_STATUS_COPY[order.status] ?? order.status}</strong>
            </span>
          </div>
          <ol className="mt-4 grid grid-cols-5 gap-1.5 text-center">
            {timeline.map((step, index) => {
              const done = currentStep >= index && currentStep !== -1;
              const eventFor = [...order.audit].reverse().find((entry) => entry.action === `order.status.${step}`);
              return (
                <li key={step} className="flex flex-col items-center gap-1.5">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${
                      done ? "bg-[#862222] text-white" : "bg-[#efe7dd] text-[#a49a90]"
                    }`}
                  >
                    {done ? "✓" : index + 1}
                  </span>
                  <span className="text-[10px] tracking-[.08em] uppercase text-[#6b6259]">
                    {ORDER_STATUS_COPY[step]}
                  </span>
                  {eventFor ? (
                    <span className="text-[9.5px] text-[#a49a90]">{formatDate(eventFor.at)}</span>
                  ) : null}
                </li>
              );
            })}
          </ol>

          {order.statusNote?.text ? (
            <div className="mt-4 border-l-2 border-[#862222] bg-[#faf6f2] px-4 py-3" data-testid="order-note">
              <p className="text-[10.5px] font-semibold tracking-[.14em] text-[#862222] uppercase">
                Update from our team
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[#4a423b]">{order.statusNote.text}</p>
              <p className="mt-1 text-[10.5px] text-[#9c8f82]">
                {formatDate(order.statusNote.at)} · {ORDER_STATUS_COPY[order.statusNote.status] ?? order.statusNote.status}
              </p>
            </div>
          ) : null}

          {order.tracking?.awb ? (
            <div className="mt-4 border-t border-[#f1ebe5] pt-3 text-[12.5px] text-[#5c534b]">
              <p>
                Courier: <strong>{order.tracking.courier ?? "—"}</strong>
                <br />
                AWB / Tracking no: <strong>{order.tracking.awb}</strong>
                {order.tracking.shippedAt ? (
                  <>
                    <br />
                    Shipped: {formatDate(order.tracking.shippedAt)}
                  </>
                ) : null}
              </p>
              {order.tracking.url ? (
                <a
                  href={order.tracking.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block border border-[#862222] px-4 py-2 text-[10.5px] font-semibold tracking-[.14em] text-[#862222] uppercase"
                >
                  Track with courier
                </a>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 border-t border-[#f1ebe5] pt-3 text-[11.5px] text-[#8a8078]">
              The AWB number appears here and on WhatsApp as soon as the parcel is dispatched.
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-[#eee6de] p-5">
          <div>
            <h2 className="text-[11px] font-semibold tracking-[.16em] uppercase">GST invoice</h2>
            <p className="mt-1 text-[11.5px] text-[#6b6259]">
              Download the tax invoice (GST 5% / 18% based on product value) — you will be asked for the last
              4 digits of the order phone number.
            </p>
          </div>
          <Link
            href={`/orders/${order.orderNumber}/invoice`}
            data-testid="download-invoice"
            className="border border-[#862222] px-5 py-2.5 text-[10.5px] font-semibold tracking-[.14em] text-[#862222] uppercase"
          >
            Download invoice
          </Link>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="border border-[#eee6de] p-5">
            <h2 className="text-[11px] font-semibold tracking-[.16em] uppercase">Delivery address</h2>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[#5c534b]">
              {order.customerName}
              <br />
              {order.address}
              <br />
              {order.city}, {order.state} — {order.pincode}
              <br />
              +91 {order.phone}
              <br />
              {order.email}
            </p>
          </div>
          <div className="border border-[#eee6de] p-5">
            <h2 className="text-[11px] font-semibold tracking-[.16em] uppercase">Payment</h2>
            <p className="mt-2 text-[12.5px] text-[#5c534b]">
              Method: <strong>{order.paymentMethod === "cod" ? "Cash on delivery" : "Prepaid (UPI / card)"}</strong>
              <br />
              Status: <strong data-testid="payment-status">{order.paymentStatus}</strong>
              {order.paymentStatus === "paid" && order.payment?.verifiedAt ? (
                <>
                  <br />
                  Verified by our team: <strong>{formatDate(order.payment.verifiedAt)}</strong>
                  {order.payment.reference ? (
                    <>
                      <br />
                      Reference: <strong>{order.payment.reference}</strong>
                    </>
                  ) : null}
                </>
              ) : null}
              <br />
              Items: <strong>{order.items.reduce((sum, item) => sum + item.quantity, 0)}</strong>
            </p>
            <div className="mt-3 space-y-1.5 border-t border-[#f0eae3] pt-3 text-[12.5px]">
              <Row label="Subtotal" value={formatPrice(order.subtotal)} />
              {order.discount > 0 ? (
                <Row label={`Coupon ${order.couponCode ?? ""}`} value={`− ${formatPrice(order.discount)}`} />
              ) : null}
              <Row label="Shipping" value="Free" />
              <Row label="Total" value={formatPrice(order.total)} strong />
            </div>
          </div>
        </div>

        <div className="mt-4 border border-[#eee6de]">
          <h2 className="border-b border-[#eee6de] px-5 py-3 text-[11px] font-semibold tracking-[.16em] uppercase">
            Items
          </h2>
          <ul className="divide-y divide-[#f1ebe5]">
            {order.items.map((item) => (
              <li key={`${item.handle}-${item.size}`} className="flex gap-3 p-4">
                <SafeImage
                  src={imageUrl(item.image, 200)}
                  alt={item.title}
                  className="h-24 w-20 shrink-0 object-cover"
                />
                <div className="flex-1">
                  <Link href={`/products/${item.handle}`} className="text-[12.5px] font-medium hover:text-[#862222]">
                    {item.title}
                  </Link>
                  <p className="mt-1 text-[11px] text-[#8a8078]">
                    Size {item.size} · Qty {item.quantity}
                  </p>
                </div>
                <span className="text-[12.5px] font-semibold text-[#862222]">
                  {formatPrice(item.price * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/collections/new-arrivals"
            className="bg-[#862222] px-7 py-3 text-[11px] font-semibold tracking-[.16em] text-white uppercase"
          >
            Continue shopping
          </Link>
          <a
            href={orderWhatsAppLink(order, siteUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className="border border-[#862222] px-7 py-3 text-[11px] font-semibold tracking-[.16em] text-[#862222] uppercase"
          >
            Send order on WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-semibold" : ""}`}>
      <span className="text-[#6b6259]">{label}</span>
      <span>{value}</span>
    </div>
  );
}
