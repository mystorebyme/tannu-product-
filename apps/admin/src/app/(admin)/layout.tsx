import type { ReactNode } from "react";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { logoutAction } from "@/app/actions";
import { AdminNav } from "@/components/admin-nav";
import { getOrders } from "@/lib/data";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const orders = await getOrders();
  const pending = orders.filter((order) => order.status === "placed").length;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          LIKSHA
          <small>CLOTHING · ADMIN</small>
        </div>
        <AdminNav pendingOrders={pending} />
        <div className="foot">
          <p style={{ margin: "0 0 8px" }}>{session.email}</p>
          <form action={logoutAction}>
            <button className="btn btn-sm" type="submit" style={{ width: "100%", justifyContent: "center" }}>
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
