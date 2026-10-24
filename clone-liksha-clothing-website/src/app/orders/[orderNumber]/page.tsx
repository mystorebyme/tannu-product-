import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  let order: typeof orders.$inferSelect | undefined;
  let items: (typeof orderItems.$inferSelect)[] = [];

  try {
    const found = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
    order = found[0];
    if (order) {
      items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    }
  } catch (error) {
    console.error("order page failed", error);
  }

  if (!order) notFound();

  const eta = new Date(order.createdAt);
  eta.setDate(eta.getDate() + 6);
  const etaLabel = eta.toLocaleDateString("en-IN", { day: "numeric", month: "long" });

  return (
    <div className="container-liksha py-10 lg:py-14">
      <div className="mx-auto max-w-[760px]">
        <div className="border border-[#e9dfd4] bg-[#faf8f5] p-6 text-center sm:p-9">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e6f2e8] text-[#2f7a3f]">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="m5 13 4 4L19 7" />
            </svg>
          </span>
          <h1 className="mt-4 font-display text-[27px] font-medium sm:text-[32px]">Thank you, {order.customerName.split(" ")[0]}!</h1>
          <p className="mt-1.5 text-[12.5px] text-[#6b6259]">
            Your order has been confirmed. We will share tracking details on WhatsApp shortly.
          </p>
          <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-[#e9dfd4] pt-4 text-[12px]">
            <span>
              Order number: <strong className="text-[#862222]">{order.orderNumber}</strong>
            </span>
            <span>
              Estimated delivery: <strong>{etaLabel}</strong>
            </span>
            <span>
              Payment: <strong>{order.paymentMethod === "cod" ? "Cash on delivery" : "Prepaid"}</strong>
            </span>
          </div>
        </div>

        <div className="mt-6 border border-[#e9dfd4]">
          <h2 className="border-b border-[#e9dfd4] bg-[#faf8f5] px-4 py-3 text-[11px] font-semibold tracking-[.16em] uppercase">
            Order details
          </h2>
          <ul className="divide-y divide-[#f1ebe5]">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.image} alt={item.title} className="h-24 w-20 shrink-0 object-cover" />
                <div className="flex-1">
                  <Link href={`/products/${item.handle}`} className="text-[12.5px] font-medium hover:text-[#862222]">
                    {item.title}
                  </Link>
                  <p className="mt-1 text-[11px] text-[#8a8078]">
                    Size: {item.size} · Qty: {item.quantity}
                  </p>
                </div>
                <span className="text-[12.5px] font-semibold text-[#862222]">
                  {formatPrice(item.price * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <div className="space-y-2 border-t border-[#e9dfd4] bg-[#faf8f5] p-4 text-[12.5px]">
            <SummaryRow label="Subtotal" value={formatPrice(order.subtotal)} />
            {order.discount > 0 ? (
              <SummaryRow label="Discount" value={`− ${formatPrice(order.discount)}`} />
            ) : null}
            <SummaryRow label="Shipping" value="Free" />
            <div className="flex justify-between border-t border-[#e9dfd4] pt-2 text-[14px] font-semibold">
              <span>Total paid</span>
              <span className="text-[#862222]">{formatPrice(order.total)}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="border border-[#e9dfd4] p-4">
            <h3 className="text-[10.5px] font-semibold tracking-[.16em] text-[#862222] uppercase">Delivery address</h3>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[#5c534b]">
              {order.customerName}
              <br />
              {order.address}
              <br />
              {order.city}, {order.state} — {order.pincode}
              <br />
              {order.phone}
              <br />
              {order.email}
            </p>
          </div>
          <div className="border border-[#e9dfd4] p-4">
            <h3 className="text-[10.5px] font-semibold tracking-[.16em] text-[#862222] uppercase">Need help?</h3>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[#5c534b]">
              WhatsApp us on{" "}
              <a href="https://wa.me/919909790455" className="font-medium text-[#862222]">
                9909790455
              </a>{" "}
              or email{" "}
              <a href="mailto:Info.likshaclothing@gmail.com" className="font-medium text-[#862222]">
                Info.likshaclothing@gmail.com
              </a>
              . 7 days replacement on this order.
            </p>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/collections/new-arrivals"
            className="bg-[#862222] px-7 py-3 text-[11px] font-semibold tracking-[.16em] text-white uppercase"
          >
            Continue shopping
          </Link>
          <a
            href={`https://wa.me/919909790455?text=${encodeURIComponent(`Hi Liksha, my order ${order.orderNumber}`)}`}
            target="_blank"
            rel="noreferrer"
            className="border border-[#862222] px-7 py-3 text-[11px] font-semibold tracking-[.16em] text-[#862222] uppercase"
          >
            Chat on WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[#6b6259]">{label}</span>
      <span>{value}</span>
    </div>
  );
}
