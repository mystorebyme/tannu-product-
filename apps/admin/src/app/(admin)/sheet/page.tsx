import Link from "next/link";
import { getSheetOverview } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Google Sheet" };

/**
 * Google Sheet = owner ka control panel.
 * Yahan wahi data dikhta hai jo sheet me hai (settings + last order/payment/message rows),
 * aur admin Settings se edit karne par sheet bhi update ho jaati hai.
 */
export default async function SheetPage() {
  const overview = await getSheetOverview();
  const settings = overview.settings ?? {};
  const recent = overview.recent ?? { orders: [], payments: [], messages: [] };
  const orderRows = recent.orders.slice(0, 10);
  const columns = ["Timestamp", "Event", "Order number", "Order status", "Payment status", "Total", "Customer", "Phone"];

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Google Sheet</h1>
          <p>Owner ki sheet ka live data — settings, orders aur payments</p>
        </div>
        <div className="actions">
          <Link className="btn" href="/settings">
            Edit settings
          </Link>
          <Link className="btn" href="/orders">
            Orders
          </Link>
        </div>
      </div>

      <div className={`notice ${overview.configured ? "" : "warn"}`} data-testid="sheet-status">
        {overview.configured ? (
          <>
            <strong>Connected</strong>
            {overview.sheet ? <> · {overview.sheet}</> : null} — settings sheet se live aati hain (15 s), aur
            har order / payment / message row sheet me append hoti hai.
            {overview.reachable === false ? (
              <div style={{ marginTop: 6, color: "var(--danger)" }}>
                Sheet URL configured hai par reply nahi aaya — Apps Script deployment (&quot;Anyone&quot;) aur token
                check kariye.
              </div>
            ) : null}
          </>
        ) : (
          <>
            <strong>Sheet connected nahi hai.</strong> Site Postgres/JSON par chal rahi hai. Setup:{" "}
            <span className="mono">docs/09-devops/google-sheets.md</span> — Apps Script deploy karke{" "}
            <span className="mono">GOOGLE_SHEETS_WEBAPP_URL</span> +{" "}
            <span className="mono">GOOGLE_SHEETS_TOKEN</span> set kariye. {overview.hint}
          </>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Live settings (sheet se)</h2>
          <span className="badge">{overview.configured ? "google-sheet" : "admin/db"}</span>
        </div>
        <div className="panel-body">
          <div className="row">
            <div className="field">
              <label>UPI ID (payments)</label>
              <div className="mono">{settings.upiId ?? "—"}</div>
            </div>
            <div className="field">
              <label>UPI payee name</label>
              <div>{settings.upiName ?? "—"}</div>
            </div>
            <div className="field">
              <label>Support phone</label>
              <div>{settings.supportPhone ?? "—"}</div>
            </div>
            <div className="field">
              <label>WhatsApp</label>
              <div>{settings.whatsapp ?? "—"}</div>
            </div>
            <div className="field">
              <label>Support email</label>
              <div className="mono">{settings.supportEmail ?? "—"}</div>
            </div>
            <div className="field">
              <label>Free shipping</label>
              <div>{settings.freeShipping === false ? "No" : "Yes"}</div>
            </div>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Announcement bar</label>
            <div>{settings.announcement || <span className="muted">default copy</span>}</div>
          </div>
          <p className="small muted" style={{ marginBottom: 0 }}>
            Settings page se save karte hi ye values sheet me bhi likh di jaati hain, aur sheet me seedha edit
            karne par 15 second me website par aa jaati hain.
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Recent orders (sheet rows)</h2>
          <span className="badge">{orderRows.length} rows</span>
        </div>
        {orderRows.length === 0 ? (
          <div className="panel-body small muted">
            Sheet me abhi koi row nahi (ya sheet connected nahi). Naya order aate hi yahan turant dikhega.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orderRows.map((row, index) => (
                <tr key={`${row["Order number"] ?? "row"}-${index}`}>
                  {columns.map((column) => (
                    <td key={column} className={column === "Order number" ? "mono" : undefined}>
                      {String(row[column] ?? "").slice(0, 60)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Recent payments</h2>
        </div>
        {recent.payments.length === 0 ? (
          <div className="panel-body small muted">Payment rows yahan dikhengi (UTR submit / verified).</div>
        ) : (
          <table>
            <thead>
              <tr>
                {["Timestamp", "Event", "Order number", "Payment status", "Payment reference", "Total"].map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.payments.slice(0, 8).map((row, index) => (
                <tr key={index}>
                  {["Timestamp", "Event", "Order number", "Payment status", "Payment reference", "Total"].map((column) => (
                    <td key={column}>{String(row[column] ?? "").slice(0, 40)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
