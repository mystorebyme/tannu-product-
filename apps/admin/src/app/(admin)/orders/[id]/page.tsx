import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrder } from "@/lib/data";
import { dateTime, inr } from "@/lib/format";
import { updateOrderStatusAction } from "@/app/actions";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const NEXT_STATUS: Record<string, string[]> = {
  placed: ["confirmed", "cancelled"],
  confirmed: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["delivered", "returned"],
  delivered: ["returned"],
  cancelled: [],
  returned: [],
};

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = getOrder(id);
  if (!order) notFound();
  const session = await getSession();
  const actions = NEXT_STATUS[order.status] ?? [];

  return (
    <>
      <div className="topbar">
        <div>
          <p className="small muted">
            <Link href="/orders">← Orders</Link>
          </p>
          <h1 className="mono">{order.orderNumber}</h1>
          <p>
            {dateTime(order.createdAt)} · {order.items.length} line items · {inr(order.total)}
          </p>
        </div>
        <span className="badge badge-warning">{order.status}</span>
      </div>

      <div className="row">
        <div className="panel" style={{ marginTop: 0 }}>
          <div className="panel-head">
            <h2>Items</h2>
          </div>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Size</th>
                <th>Qty</th>
                <th className="right">Price</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={`${item.handle}-${item.size}`}>
                  <td>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className="thumb" src={`${item.image}?width=120`} alt="" />
                      <span>{item.title}</span>
                    </div>
                  </td>
                  <td>{item.size}</td>
                  <td>{item.quantity}</td>
                  <td className="right">{inr(item.price * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="panel-body">
            <table>
              <tbody>
                <tr>
                  <td className="muted">Subtotal</td>
                  <td className="right">{inr(order.subtotal)}</td>
                </tr>
                {order.discount > 0 ? (
                  <tr>
                    <td className="muted">Coupon {order.couponCode}</td>
                    <td className="right">− {inr(order.discount)}</td>
                  </tr>
                ) : null}
                <tr>
                  <td className="muted">Shipping</td>
                  <td className="right">Free</td>
                </tr>
                <tr>
                  <td>
                    <strong>Total</strong>
                  </td>
                  <td className="right">
                    <strong>{inr(order.total)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="panel" style={{ marginTop: 0 }}>
            <div className="panel-head">
              <h2>Customer</h2>
            </div>
            <div className="panel-body small">
              <p style={{ marginTop: 0 }}>
                <strong>{order.customerName}</strong>
                <br />
                {order.address}
                <br />
                {order.city}, {order.state} — {order.pincode}
                <br />
                +91 {order.phone}
                <br />
                {order.email}
              </p>
              {order.notes ? <p className="notice">{order.notes}</p> : null}
              <a className="btn btn-sm" href={`https://wa.me/91${order.phone}`} target="_blank" rel="noreferrer">
                WhatsApp customer
              </a>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Update status</h2>
            </div>
            <div className="panel-body">
              {actions.length === 0 ? (
                <p className="small muted">Is order ka lifecycle complete hai.</p>
              ) : (
                <form action={updateOrderStatusAction}>
                  <input type="hidden" name="orderNumber" value={order.orderNumber} />
                  <input type="hidden" name="actor" value={session?.email ?? "admin"} />
                  <div className="field">
                    <label htmlFor="status">New status</label>
                    <select id="status" name="status" defaultValue={actions[0]}>
                      {actions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="note">Note (audit log me jaayega)</label>
                    <input id="note" name="note" placeholder="e.g. handed to Delhivery" />
                  </div>
                  <button className="btn btn-primary" type="submit">
                    Save status
                  </button>
                </form>
              )}
              <p className="small muted" style={{ marginBottom: 0 }}>
                Payment: <strong>{order.paymentMethod === "cod" ? "COD" : order.paymentStatus}</strong>
              </p>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Audit trail</h2>
            </div>
            <div className="panel-body small">
              {order.audit.map((entry, index) => (
                <p key={index} style={{ margin: "0 0 8px" }}>
                  <span className="muted">{dateTime(entry.at)}</span> · <strong>{entry.actor}</strong> ·{" "}
                  {entry.action}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
