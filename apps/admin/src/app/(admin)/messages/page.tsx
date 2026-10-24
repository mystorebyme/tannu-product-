import { getMessages } from "@/lib/data";
import { markMessageHandledAction, setMessageReplyAction } from "@/app/actions";
import { dateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Website ke "Send us a message" form se aaye messages.
 * Storefront API (Postgres) se aate hain — koi message kho nahi jaata.
 */
export default async function MessagesPage() {
  const messages = await getMessages(100);
  const open = messages.filter((message) => !message.handled);
  const replied = messages.filter((message) => message.replied);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Messages</h1>
          <p>
            Website ke contact form se — {messages.length} total, {open.length} unreplied, {replied.length} replied
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
                      {message.replied ? (
                        <span className="badge badge-success">Replied</span>
                      ) : message.handled ? (
                        <span className="badge">Handled</span>
                      ) : (
                        <span className="badge badge-warning">New</span>
                      )}
                      {message.repliedAt ? (
                        <div className="small muted">{dateTime(message.repliedAt)}</div>
                      ) : null}
                    </td>
                    <td>
                      <div className="small" style={{ display: "grid", gap: 6 }}>
                        {message.replied ? (
                          <form action={setMessageReplyAction}>
                            <input type="hidden" name="id" value={message.id} />
                            <input type="hidden" name="replied" value="false" />
                            <button className="btn btn-sm" type="submit">
                              Undo replied
                            </button>
                          </form>
                        ) : (
                          <form action={setMessageReplyAction}>
                            <input type="hidden" name="id" value={message.id} />
                            <input type="hidden" name="replied" value="true" />
                            <button className="btn btn-sm" type="submit">
                              Mark replied
                            </button>
                          </form>
                        )}
                        {message.handled ? (
                          <span className="muted">{message.handledBy ?? "—"}</span>
                        ) : (
                          <form action={markMessageHandledAction}>
                            <input type="hidden" name="id" value={message.id} />
                            <button className="btn btn-sm" type="submit">
                              Mark handled
                            </button>
                          </form>
                        )}
                      </div>
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
