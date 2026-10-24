import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { contactMessages, newsletterSubscribers } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-guard";
import { MessageActions } from "@/components/admin/message-actions";

export const dynamic = "force-dynamic";

export default async function AdminMessagesPage() {
  await requireAdmin();
  const messages = await db
    .select()
    .from(contactMessages)
    .orderBy(desc(contactMessages.createdAt))
    .limit(200);
  const subscribers = await db
    .select()
    .from(newsletterSubscribers)
    .orderBy(desc(newsletterSubscribers.createdAt))
    .limit(300);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-medium text-[#2f2a25]">Messages</h1>
          <p className="mt-0.5 text-[11.5px] text-[#8a8078]">
            {messages.length} enquiries · {subscribers.length} newsletter subscribers
          </p>
        </div>
        <Link
          href="/admin"
          className="border border-[#ddd2c6] px-4 py-2.5 text-[10.5px] font-semibold tracking-[.14em] uppercase"
        >
          Back to dashboard
        </Link>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <section className="border border-[#e4d9cd] bg-white">
          <h2 className="border-b border-[#f1ebe5] px-4 py-3 text-[11px] font-semibold tracking-[.16em] uppercase">
            Customer enquiries
          </h2>
          {messages.length === 0 ? (
            <p className="px-4 py-14 text-center text-[12px] text-[#8a8078]">
              No messages yet. The contact form on /pages/contact feeds this list.
            </p>
          ) : (
            <ul className="divide-y divide-[#f4efe9]">
              {messages.map((message) => (
                <li key={message.id} className={`p-4 ${message.read ? "" : "bg-[#fffaf2]"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[12px] font-medium">
                        {message.name}{" "}
                        {!message.read ? (
                          <span className="ml-1 rounded-full bg-[#862222] px-1.5 py-0.5 text-[9px] text-white">NEW</span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-[10.5px] text-[#a49a90]">
                        {message.email}
                        {message.phone ? ` · ${message.phone}` : ""}
                        {message.subject ? ` · ${message.subject}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <a href={`mailto:${message.email}`} className="text-[10px] text-[#862222] underline">
                        Reply
                      </a>
                      <MessageActions messageId={message.id} />
                    </div>
                  </div>
                  <p className="mt-2 text-[11.5px] leading-relaxed text-[#5c534b]">{message.message}</p>
                  <p className="mt-1.5 text-[9.5px] text-[#a49a90]">
                    {new Date(message.createdAt).toLocaleString("en-IN")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="h-fit border border-[#e4d9cd] bg-white">
          <h2 className="border-b border-[#f1ebe5] px-4 py-3 text-[11px] font-semibold tracking-[.16em] uppercase">
            Newsletter subscribers
          </h2>
          {subscribers.length === 0 ? (
            <p className="px-4 py-12 text-center text-[12px] text-[#8a8078]">No subscribers yet.</p>
          ) : (
            <ul className="max-h-[560px] divide-y divide-[#f4efe9] overflow-y-auto">
              {subscribers.map((subscriber) => (
                <li key={subscriber.id} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <p className="text-[11.5px]">{subscriber.email}</p>
                    <p className="text-[9.5px] text-[#a49a90]">
                      {new Date(subscriber.createdAt).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <a href={`mailto:${subscriber.email}`} className="text-[10px] text-[#862222] underline">
                    Email
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}


