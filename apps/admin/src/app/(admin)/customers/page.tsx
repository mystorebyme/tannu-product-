import { getOrders } from "@/lib/data";
import { dateOnly, inr } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function CustomersPage() {
  const orders = getOrders();
  const map = new Map<
    string,
    { name: string; phone: string; email: string; city: string; orders: number; spend: number; last: string }
  >();

  for (const order of orders) {
    const key = order.phone;
    const entry =
      map.get(key) ?? {
        name: order.customerName,
        phone: order.phone,
        email: order.email,
        city: order.city,
        orders: 0,
        spend: 0,
        last: order.createdAt,
      };
    entry.orders += 1;
    entry.spend += order.total;
    if (order.createdAt > entry.last) entry.last = order.createdAt;
    map.set(key, entry);
  }

  const customers = [...map.values()].sort((a, b) => b.spend - a.spend);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Customers</h1>
          <p>{customers.length} unique customers · orders se derive kiya gaya</p>
        </div>
      </div>

      <div className="panel">
        {customers.length === 0 ? (
          <div className="empty">Abhi koi customer data nahi hai.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>City</th>
                <th>Orders</th>
                <th>Lifetime value</th>
                <th>Last order</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.phone}>
                  <td>
                    <strong>{customer.name}</strong>
                    <div className="small muted">
                      +91 {customer.phone} · {customer.email}
                    </div>
                  </td>
                  <td>{customer.city}</td>
                  <td>{customer.orders}</td>
                  <td>{inr(customer.spend)}</td>
                  <td className="muted small">{dateOnly(customer.last)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="notice" style={{ marginTop: 14 }}>
        DPDP note: customer data sirf order fulfil karne aur support ke liye use karein. Erasure request
        aane par yeh record delete karna hoga — process `docs/07-security/india-compliance-dpdp.md` me hai.
      </div>
    </>
  );
}
