import Link from "next/link";
import { requireAdmin } from "@/lib/admin-guard";
import { getAllOrders, STATUS_COLORS, STATUS_LABELS } from "@/lib/admin-data";
import { formatPrice } from "@/lib/format";
import { OrdersFilter } from "@/components/admin/orders-filter";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireAdmin();
  const { status = "", q = "" } = await searchParams;
  const orders = await getAllOrders(300);

  const term = q.trim().toLowerCase();
  const filtered = orders.filter((order) => {
    if (status && order.status !== status) return false;
    if (term) {
      const haystack =
        `${order.orderNumber} ${order.customerName} ${order.email} ${order.phone} ${order.trackingId ?? ""} ${order.city}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });

  const revenue = filtered.reduce((sum, order) => (order.status === "cancelled" ? sum : sum + order.total), 0);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-medium text-[#2f2a25]">Orders</h1>
          <p className="mt-0.5 text-[11.5px] text-[#8a8078]">
            {filtered.length} orders · {formatPrice(revenue)} collected
          </p>
        </div>
        <Link
          href="/admin"
          className="border border-[#ddd2c6] px-4 py-2.5 text-[10.5px] font-semibold tracking-[.14em] uppercase"
        >
          Back to dashboard
        </Link>
      </div>

      <div className="mt-5">
        <OrdersFilter status={status} query={q} />
      </div>

      <div className="mt-3 border border-[#e4d9cd] bg-white">
        {filtered.length === 0 ? (
          <p className="px-4 py-16 text-center text-[12px] text-[#8a8078]">
            No orders match this filter. Place a test order from the storefront to see it here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-[12px]">
              <thead>
                <tr className="bg-[#faf8f5] text-left text-[9.5px] tracking-[.14em] text-[#9c8f82] uppercase">
                  <th className="px-4 py-2.5 font-medium">Order</th>
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-4 py-2.5 font-medium">Items</th>
                  <th className="px-4 py-2.5 font-medium">Payment</th>
                  <th className="px-4 py-2.5 font-medium">Tracking</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <tr key={order.id} className="border-t border-[#f4efe9] align-top hover:bg-[#fdfbf9]">
                    <td className="px-4 py-3">
                      <Link href={`/admin/orders/${order.id}`} className="font-semibold text-[#862222]">
                        {order.orderNumber}
                      </Link>
                      <div className="mt-0.5 text-[10px] text-[#a49a90]">
                        {new Date(order.createdAt).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{order.customerName}</div>
                      <div className="text-[10px] text-[#a49a90]">{order.email}</div>
                      <div className="text-[10px] text-[#a49a90]">{order.phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[10.5px] text-[#6b6259]">
                        {order.city}, {order.state} — {order.pincode}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] ${
                          order.paymentMethod === "cod" ? "bg-[#fdf2e2] text-[#94620c]" : "bg-[#eaf3fb] text-[#1f5f8b]"
                        }`}
                      >
                        {order.paymentMethod === "cod" ? "COD" : "Prepaid"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {order.trackingId ? (
                        <div>
                          <div className="font-medium tracking-[.06em] text-[#862222]">{order.trackingId}</div>
                          <div className="text-[10px] text-[#a49a90]">{order.courier ?? "—"}</div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-[#a49a90]">Not added</span>
                      )}
                      {order.trackingEmailSentAt ? (
                        <div className="mt-0.5 text-[9.5px] text-[#2f7a3f]">✉ Mail sent</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          STATUS_COLORS[order.status] ?? STATUS_COLORS.pending
                        }`}
                      >
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatPrice(order.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
