import Link from "next/link";
import { requireAdmin } from "@/lib/admin-guard";
import { getDashboardStats } from "@/lib/admin-data";
import { ResyncButton } from "@/components/admin/resync-button";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const stats = await getDashboardStats();

  const envRows = [
    { key: "ADMIN_USER / ADMIN_PASSWORD", value: "Set via environment variables" },
    { key: "ADMIN_SECRET", value: process.env.ADMIN_SECRET ? "Configured" : "Default (set a custom secret in production)" },
    { key: "RESEND_API_KEY", value: process.env.RESEND_API_KEY ? "Configured — emails are delivered" : "Not set — emails are queued in the outbox" },
    { key: "EMAIL_FROM", value: process.env.EMAIL_FROM || "Liksha Clothing <orders@likshaclothing.com>" },
    { key: "DATABASE_URL", value: process.env.DATABASE_URL ? "Configured" : "Missing" },
    { key: "NEXT_PUBLIC_SITE_URL", value: process.env.NEXT_PUBLIC_SITE_URL || "https://www.likshaclothing.com" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-medium text-[#2f2a25]">Settings</h1>
          <p className="mt-0.5 text-[11.5px] text-[#8a8078]">Store configuration, data and environment</p>
        </div>
        <Link
          href="/admin"
          className="border border-[#ddd2c6] px-4 py-2.5 text-[10.5px] font-semibold tracking-[.14em] uppercase"
        >
          Back to dashboard
        </Link>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="border border-[#e4d9cd] bg-white p-4">
          <h2 className="text-[11px] font-semibold tracking-[.16em] uppercase">Catalog data</h2>
          <p className="mt-2 text-[11.5px] leading-relaxed text-[#5c534b]">
            The store is stocked with {stats.productCount} products and their full image galleries. Re-syncing
            restores the default catalogue (titles, prices, sizes, images) from the product data file and keeps
            your orders untouched.
          </p>
          <div className="mt-3">
            <ResyncButton />
          </div>
        </section>

        <section className="border border-[#e4d9cd] bg-white p-4">
          <h2 className="text-[11px] font-semibold tracking-[.16em] uppercase">Environment</h2>
          <ul className="mt-2 divide-y divide-[#f4efe9]">
            {envRows.map((row) => (
              <li key={row.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-[10.5px] tracking-[.06em] text-[#6b6259]">{row.key}</span>
                <span className="text-[11px] font-medium text-[#2f2a25]">{row.value}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="border border-[#e4d9cd] bg-white p-4">
          <h2 className="text-[11px] font-semibold tracking-[.16em] uppercase">Admin access</h2>
          <p className="mt-2 text-[11.5px] leading-relaxed text-[#5c534b]">
            This console lives at <code className="bg-[#f6f1ec] px-1.5 py-0.5">/admin</code> and is deliberately
            hidden from visitors: there is no link in the header, footer, navigation or sitemap, every admin page
            sends <code className="bg-[#f6f1ec] px-1.5 py-0.5">noindex</code>, and all admin API routes reject
            unauthorised requests with HTTP 401.
          </p>
          <p className="mt-2 text-[11.5px] leading-relaxed text-[#5c534b]">
            Change the credentials with <code className="bg-[#f6f1ec] px-1.5 py-0.5">ADMIN_USER</code>,
            <code className="bg-[#f6f1ec] px-1.5 py-0.5"> ADMIN_PASSWORD</code> and
            <code className="bg-[#f6f1ec] px-1.5 py-0.5"> ADMIN_SECRET</code>.
          </p>
        </section>

        <section className="border border-[#e4d9cd] bg-white p-4">
          <h2 className="text-[11px] font-semibold tracking-[.16em] uppercase">Quick links</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              { label: "Storefront", href: "/" },
              { label: "Orders", href: "/admin/orders" },
              { label: "Products", href: "/admin/products" },
              { label: "Email outbox", href: "/admin/emails" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="border border-[#e4d9cd] px-3 py-2.5 text-[11px] tracking-[.1em] uppercase hover:border-[#862222] hover:text-[#862222]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
