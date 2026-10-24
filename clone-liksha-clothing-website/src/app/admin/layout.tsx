import Link from "next/link";
import type { ReactNode } from "react";
import { isAuthenticated } from "@/lib/admin-auth";
import { AdminNav } from "@/components/admin/admin-nav";

export const metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const authed = await isAuthenticated();

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#f4efea]">
        <main className="mx-auto flex min-h-screen max-w-[420px] flex-col justify-center px-5 py-10">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4efea]">
      <div className="mx-auto flex max-w-[1500px]">
        <aside className="sticky top-0 hidden h-screen w-[220px] shrink-0 flex-col border-r border-[#e4d9cd] bg-[#862222] text-[#f6e6d6] md:flex">
          <Link href="/admin" className="block border-b border-[#a03a3a] px-5 py-5">
            <span className="block font-display text-[19px] tracking-[.18em] text-[#fdf3e6] uppercase">
              Liksha
            </span>
            <span className="mt-0.5 block text-[9.5px] tracking-[.22em] text-[#f0c98e] uppercase">
              Admin console
            </span>
          </Link>
          <AdminNav />
          <div className="mt-auto border-t border-[#a03a3a] px-5 py-4">
            <form action="/api/admin/logout" method="post">
              <button
                type="submit"
                className="w-full border border-[#e9c98f] py-2 text-[10.5px] font-semibold tracking-[.16em] text-[#f6e6d6] uppercase"
              >
                Sign out
              </button>
            </form>
          </div>
        </aside>
        <div className="flex min-h-screen flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-[#e4d9cd] bg-white px-4 py-3 md:hidden">
            <Link href="/admin" className="font-display text-[17px] tracking-[.16em] text-[#862222] uppercase">
              Liksha Admin
            </Link>
            <form action="/api/admin/logout" method="post">
              <button type="submit" className="text-[10.5px] tracking-[.12em] uppercase">
                Sign out
              </button>
            </form>
          </header>
          <div className="md:hidden">
            <AdminNav mobile />
          </div>
          <main className="flex-1 px-4 py-6 md:px-7 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}


