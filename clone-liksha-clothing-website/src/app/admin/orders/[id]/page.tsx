import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-guard";
import { getOrderWithItems, STATUS_COLORS, STATUS_LABELS } from "@/lib/admin-data";
import { formatPrice } from "@/lib/format";
import { OrderActions } from "@/components/admin/order-actions";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) notFound();

  const data = await getOrderWithItems(orderId);
  if (!data) notFound();
  const { order, items } = data;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/orders" className="text-[10.5px] tracking-[.12em] text-[#8a8078] uppercase">
            ← All orders
          </Link>
          <h1 className="mt-1 font-display text-[27px] font-medium text-[#2f2a25]">{order.orderNumber}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#8a8078]">
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                STATUS_COLORS[order.status] ?? STATUS_COLORS.pending
              }`}
            >
              {STATUS_LABELS[order.status] ?? order.status}
            </span>
            <span>
              Placed{" "}
              {new Date(order.createdAt).toLocaleString("en-IN", {
                day: "2-digit",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span>{order.paymentMethod === "cod" ? "Cash on delivery" : "Prepaid"}</span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-5">
          <section className="border border-[#e4d9cd] bg-white">
            <h2 className="border-b border-[#f1ebe5] px-4 py-3 text-[11px] font-semibold tracking-[.16em] uppercase">
              Items
            </h2>
            <ul className="divide-y divide-[#f4efe9]">
              {items.map((item) => (
                <li key={item.id} className="flex items-start gap-3 p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.image} alt="" className="h-20 w-16 border border-[#eee6de] object-cover" />
                  <div className="flex-1">
                    <Link href={`/products/${item.handle}`} target="_blank" className="text-[12px] font-medium hover:text-[#862222]">
                      {item.title}
                    </Link>
                    <div className="mt-1 text-[10.5px] text-[#8a8078]">
                      Size: {item.size} · Qty: {item.quantity}
                    </div>
                    <div className="mt-0.5 text-[10px] text-[#a49a90]">{item.handle}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[12px] font-semibold text-[#862222]">
                      {formatPrice(item.price * item.quantity)}
                    </div>
                    <div className="text-[10px] text-[#a49a90]">{formatPrice(item.price)} each</div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="space-y-1.5 border-t border-[#f1ebe5] bg-[#faf8f5] p-4 text-[12px]">
              <div className="flex justify-between">
                <span className="text-[#6b6259]">Subtotal</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              {order.discount > 0 ? (
                <div className="flex justify-between text-[#2f7a3f]">
                  <span>Discount</span>
                  <span>− {formatPrice(order.discount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span className="text-[#6b6259]">Shipping</span>
                <span>Free</span>
              </div>
              <div className="flex items-center justify-between border-t border-[#e7ddd2] pt-2 text-[14px] font-semibold">
                <span>Total</span>
                <span className="text-[#862222]">{formatPrice(order.total)}</span>
              </div>
            </div>
          </section>

          <section className="border border-[#e4d9cd] bg-white p-4">
            <h2 className="text-[11px] font-semibold tracking-[.16em] uppercase">Internal notes</h2>
            <p className="mt-2 text-[12px] leading-relaxed text-[#5c534b]">
              {order.notes?.trim() ? order.notes : "No notes added by the customer."}
            </p>
          </section>
        </div>

        <div className="space-y-5">
          <OrderActions
            orderId={order.id}
            status={order.status}
            courier={order.courier ?? ""}
            trackingId={order.trackingId ?? ""}
            customerEmail={order.email}
            customerName={order.customerName}
            trackingEmailSentAt={order.trackingEmailSentAt ? new Date(order.trackingEmailSentAt).toISOString() : null}
          />

          <section className="border border-[#e4d9cd] bg-white p-4">
            <h2 className="text-[11px] font-semibold tracking-[.16em] uppercase">Customer</h2>
            <div className="mt-2 space-y-1 text-[12px] text-[#5c534b]">
              <p className="font-medium text-[#2f2a25]">{order.customerName}</p>
              <p>
                <a href={`mailto:${order.email}`} className="text-[#862222] underline">
                  {order.email}
                </a>
              </p>
              <p>
                <a href={`https://wa.me/91${order.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="text-[#862222] underline">
                  {order.phone}
                </a>
              </p>
            </div>
            <h3 className="mt-3 text-[10px] tracking-[.14em] text-[#8a8078] uppercase">Shipping address</h3>
            <p className="mt-1.5 text-[12px] leading-relaxed text-[#5c534b]">
              {order.address}
              <br />
              {order.city}, {order.state} — {order.pincode}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
