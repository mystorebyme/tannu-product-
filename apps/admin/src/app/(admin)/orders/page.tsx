import Link from "next/link";
import { getOrders } from "@/lib/data";
import { dateTime, inr } from "@/lib/format";

export const dynamic = "force-dynamic";

const FILTERS = ["all", "placed", "confirmed", "packed", "shipped", "delivered", "cancelled"] as const;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status = "all", q = "" } = await searchParams;
  const term = q.trim().toLowerCase();
  const orders = getOrders()
    .filter((order) => (status === "all" ? true : order.status === status))
    .filter((order) =>
      term
        ? `${order.orderNumber} ${order.customerName} ${order.phone} ${order.email}`.toLowerCase().includes(term)
        : true,
    );

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Orders</h1>
          <p>{orders.length} orders · status ke hisaab se filter kariye</p>
        </div>
        <form className="actions" action="/orders">
          <input name="q" defaultValue={q} placeholder="Order number / phone / name" style={{ width: 260 }} />
          <input type="hidden" name="status" value={status} />
          <button className="btn" type="submit">
            Search
          </button>
        </form>
      </div>

      <div className="actions" style={{ marginBottom: 12 }}>
        {FILTERS.map((filter) => (
          <Link
            key={filter}
            href={`/orders?status=${filter}`}
            className={`btn btn-sm ${filter === status ? "btn-primary" : ""}`}
          >
            {filter}
          </Link>
        ))}
      </div>

      <div className="panel">
        {orders.length === 0 ? (
          <div className="empty">Koi order nahi mila.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Payment</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link className="mono" href={`/orders/${order.orderNumber}`}>
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td>
                    {order.customerName}
                    <div className="small muted">+91 {order.phone}</div>
                  </td>
                  <td>{order.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                  <td>
                    <span className={`badge ${order.paymentStatus === "paid" ? "badge-success" : order.paymentStatus === "cod" ? "" : "badge-warning"}`}>
                      {order.paymentMethod === "cod" ? "COD" : order.paymentStatus}
                    </span>
                  </td>
                  <td>{inr(order.total)}</td>
                  <td>
                    <span className="badge">{order.status}</span>
                  </td>
                  <td className="muted small">{dateTime(order.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
