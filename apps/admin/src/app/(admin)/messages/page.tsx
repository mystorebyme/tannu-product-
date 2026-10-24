import { getMessages } from "@/lib/data";
import { markMessageHandledAction } from "@/app/actions";
import { dateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Website ke "Send us a message" form se aaye messages.
 * Storefront API (Postgres) se aate hain — koi message kho nahi jaata.
 */
export default async function MessagesPage() {
  const messages = await getMessages(100);
  const open = messages.filter((message) => !message.handled);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Messages</h1>
          <p>
            Website ke contact form se — {messages.length} total, {open.length} unread
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Inbox</h2>
          <span className="badge">{open.length} new</span>
        </div>
        <div className="panel-body">
          {messages.length === 0 ? (
            <p className="muted">Abhi koi message nahi aaya.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>From</th>
                  <th>Subject</th>
                  <th>Message</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {messages.map((message) => (
                  <tr key={message.id}>
                    <td className="small muted">{dateTime(message.createdAt)}</td>
                    <td className="small">
                      <strong>{message.name}</strong>
                      <br />
                      <a href={`mailto:${message.email}`}>{message.email}</a>
                      {message.phone ? (
                        <>
                          <br />
                          <a
                            href={`https://wa.me/91${message.phone.replace(/\D/g, "").slice(-10)}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {message.phone}
                          </a>
                        </>
                      ) : null}
                    </td>
                    <td className="small">{message.subject ?? "—"}</td>
                    <td className="small" style={{ maxWidth: 420, whiteSpace: "pre-wrap" }}>
                      {message.message}
                    </td>
                    <td>
                      <span className={message.handled ? "badge badge-success" : "badge badge-warning"}>
                        {message.handled ? "Handled" : "New"}
                      </span>
                    </td>
                    <td>
                      {message.handled ? (
                        <span className="small muted">{message.handledBy ?? "—"}</span>
                      ) : (
                        <form action={markMessageHandledAction}>
                          <input type="hidden" name="id" value={message.id} />
                          <button className="btn btn-sm" type="submit">
                            Mark handled
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
