import Link from "next/link";
import { requireAdmin } from "@/lib/admin-guard";
import { getEmailHistory } from "@/lib/mailer";
import { EmailPreview } from "@/components/admin/email-preview";

export const dynamic = "force-dynamic";

export default async function AdminEmailsPage() {
  await requireAdmin();
  const history = await getEmailHistory(100);
  const sent = history.filter((email) => email.status === "sent").length;
  const queued = history.filter((email) => email.status === "queued").length;
  const failed = history.filter((email) => email.status === "failed").length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-medium text-[#2f2a25]">Email outbox</h1>
          <p className="mt-0.5 text-[11.5px] text-[#8a8078]">
            {history.length} emails · {sent} sent · {queued} queued · {failed} failed
          </p>
        </div>
        <Link
          href="/admin"
          className="border border-[#ddd2c6] px-4 py-2.5 text-[10.5px] font-semibold tracking-[.14em] uppercase"
        >
          Back to dashboard
        </Link>
      </div>

      <div className="mt-4 border border-[#e4d9cd] bg-[#fffaf2] px-4 py-3 text-[11px] leading-relaxed text-[#7a5b1e]">
        <strong>Delivery status:</strong>{" "}
        {process.env.RESEND_API_KEY
          ? "RESEND_API_KEY is configured — emails are delivered to customers and archived here."
          : "No RESEND_API_KEY is configured yet, so every email is rendered and archived in this outbox. Add RESEND_API_KEY (and EMAIL_FROM) to deliver them to customers automatically."}
      </div>

      <div className="mt-4">
        {history.length === 0 ? (
          <div className="border border-[#e4d9cd] bg-white px-4 py-16 text-center">
            <p className="text-[12px] text-[#8a8078]">
              No emails yet. Mark an order as shipped with a tracking ID and the customer email appears here.
            </p>
            <Link
              href="/admin/orders"
              className="mt-4 inline-block bg-[#862222] px-6 py-2.5 text-[10.5px] font-semibold tracking-[.14em] text-white uppercase"
            >
              Go to orders
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {history.map((email) => (
              <li key={email.id} className="border border-[#e4d9cd] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f1ebe5] px-4 py-3">
                  <div>
                    <p className="text-[12px] font-medium">{email.subject}</p>
                    <p className="mt-0.5 text-[10.5px] text-[#a49a90]">
                      To: {email.toEmail} · {new Date(email.createdAt).toLocaleString("en-IN")}
                      {email.trackingId ? ` · Tracking ${email.trackingId}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] capitalize ${
                        email.status === "sent"
                          ? "bg-[#eaf6ec] text-[#2f7a3f]"
                          : email.status === "queued"
                            ? "bg-[#fdf2e2] text-[#94620c]"
                            : "bg-[#fbeaea] text-[#b3261e]"
                      }`}
                    >
                      {email.status} · {email.provider}
                    </span>
                    {email.orderId ? (
                      <Link href={`/admin/orders/${email.orderId}`} className="text-[10px] text-[#862222] underline">
                        Order
                      </Link>
                    ) : null}
                  </div>
                </div>
                <EmailPreview html={email.html} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
