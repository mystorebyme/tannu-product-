"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/collections", label: "Collections" },
  { href: "/admin/messages", label: "Messages" },
  { href: "/admin/emails", label: "Email outbox" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  if (mobile) {
    return (
      <nav className="flex gap-1 overflow-x-auto border-b border-[#e4d9cd] bg-white px-3 py-2">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] ${
                active ? "bg-[#862222] text-white" : "text-[#5c534b]"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col py-3">
      {links.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center justify-between px-5 py-2.5 text-[11.5px] tracking-[.12em] uppercase transition ${
              active ? "bg-[#6d1a1a] text-white" : "text-[#f0d9c4] hover:bg-[#751c1c]"
            }`}
          >
            {link.label}
            {active ? <span className="text-[#f0c98e]">•</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
