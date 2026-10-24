import Link from "next/link";
import { requireAdmin } from "@/lib/admin-guard";
import { getDashboardStats, STATUS_COLORS, STATUS_LABELS, money } from "@/lib/admin-data";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdmin();
  const stats = await getDashboardStats();

  const cards = [
    { label: "Total revenue", value: money(stats.revenue), hint: "Excludes cancelled orders" },
    { label: "Orders", value: String(stats.orderCount), hint: "All time" },
    { label: "Products", value: String(stats.productCount), hint: "Live in store" },
    { label: "Emails sent", value: String(stats.emailCount), hint: "Tracking & confirmations" },
    { label: "Messages", value: String(stats.messageCount), hint: "Customer enquiries" },
    { label: "Subscribers", value: String(stats.subscriberCount), hint: "Newsletter list" },
  ];

  const totalStatuses = stats.byStatus.reduce((sum, row) => sum + row.count, 0) || 1;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-medium text-[#2f2a25]">Dashboard</h1>
          <p className="mt-0.5 text-[11.5px] text-[#8a8078]">
            Store overview · {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/orders" className="border border-[#862222] px-4 py-2.5 text-[10.5px] font-semibold tracking-[.14em] text-[#862222] uppercase">
            Manage orders
          </Link>
          <Link href="/admin/products" className="bg-[#862222] px-4 py-2.5 text-[10.5px] font-semibold tracking-[.14em] text-white uppercase">
            Add product
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => (
          <div key={card.label} className="border border-[#e4d9cd] bg-white p-4">
            <p className="text-[9.5px] tracking-[.16em] text-[#9c8f82] uppercase">{card.label}</p>
            <p className="mt-1.5 font-display text-[24px] leading-none text-[#862222]">{card.value}</p>
            <p className="mt-1.5 text-[10px] text-[#a49a90]">{card.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <section className="border border-[#e4d9cd] bg-white">
          <div className="flex items-center justify-between border-b border-[#f1ebe5] px-4 py-3">
            <h2 className="text-[11px] font-semibold tracking-[.16em] uppercase">Recent orders</h2>
            <Link href="/admin/orders" className="text-[10.5px] text-[#862222] underline">View all</Link>
          </div>
          {stats.recentOrders.length === 0 ? (
            <p className="px-4 py-10 text-center text-[12px] text-[#8a8078]">No orders yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-[12px]">
                <thead>
                  <tr className="bg-[#faf8f5] text-left text-[9.5px] tracking-[.14em] text-[#9c8f82] uppercase">
                    <th className="px-4 py-2.5 font-medium">Order</th>
                    <th className="px-4 py-2.5 font-medium">Customer</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentOrders.map((order) => (
                    <tr key={order.id} className="border-t border-[#f4efe9] hover:bg-[#fdfbf9]">
                      <td className="px-4 py-2.5">
                        <Link href={`/admin/orders/${order.id}`} className="font-medium text-[#862222]">
                          {order.orderNumber}
                        </Link>
                        <div className="text-[10px] text-[#a49a90]">
                          {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div>{order.customerName}</div>
                        <div className="text-[10px] text-[#a49a90]">{order.city}, {order.state}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[order.status] ?? STATUS_COLORS.pending}`}>
                          {STATUS_LABELS[order.status] ?? order.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium">{formatPrice(order.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="space-y-5">
          <section className="border border-[#e4d9cd] bg-white p-4">
            <h2 className="text-[11px] font-semibold tracking-[.16em] uppercase">Orders by status</h2>
            <ul className="mt-3 space-y-2.5">
              {stats.byStatus.map((row) => (
                <li key={row.status}>
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span>{STATUS_LABELS[row.status] ?? row.status}</span>
                    <span className="font-medium text-[#862222]">{row.count}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full bg-[#f1ebe5]">
                    <div
                      className="h-1.5 bg-[#862222]"
                      style={{ width: `${Math.round((row.count / totalStatuses) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="border border-[#e4d9cd] bg-white">
            <div className="flex items-center justify-between border-b border-[#f1ebe5] px-4 py-3">
              <h2 className="text-[11px] font-semibold tracking-[.16em] uppercase">Top selling</h2>
              <Link href="/admin/products" className="text-[10.5px] text-[#862222] underline">Products</Link>
            </div>
            {stats.topProducts.length === 0 ? (
              <p className="px-4 py-8 text-center text-[12px] text-[#8a8078]">No sales data yet.</p>
            ) : (
              <ul className="divide-y divide-[#f4efe9]">
                {stats.topProducts.map((product) => (
                  <li key={product.handle} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <Link href={`/products/${product.handle}`} className="line-clamp-1 text-[11.5px] hover:text-[#862222]">
                        {product.title}
                      </Link>
                      <div className="text-[10px] text-[#a49a90]">{product.units} units sold</div>
                    </div>
                    <span className="text-[11.5px] font-medium text-[#862222]">
                      {formatPrice(product.revenue ?? 0)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="border border-[#e4d9cd] bg-white">
            <div className="flex items-center justify-between border-b border-[#f1ebe5] px-4 py-3">
              <h2 className="text-[11px] font-semibold tracking-[.16em] uppercase">Email outbox</h2>
              <Link href="/admin/emails" className="text-[10.5px] text-[#862222] underline">View all</Link>
            </div>
            {stats.latestEmails.length === 0 ? (
              <p className="px-4 py-8 text-center text-[12px] text-[#8a8078]">No emails yet.</p>
            ) : (
              <ul className="divide-y divide-[#f4efe9]">
                {stats.latestEmails.map((email) => (
                  <li key={email.id} className="px-4 py-2.5">
                    <div className="line-clamp-1 text-[11.5px]">{email.subject}</div>
                    <div className="mt-0.5 flex items-center justify-between text-[10px] text-[#a49a90]">
                      <span>{email.toEmail}</span>
                      <span className="capitalize">{email.status}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
