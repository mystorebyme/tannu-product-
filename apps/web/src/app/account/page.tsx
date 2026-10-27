import Link from "next/link";
import type { Metadata } from "next";
import { TrackOrderForm } from "@/components/track-order-form";
import { WhatsAppHelpLine } from "@/components/contact-details";

export const metadata: Metadata = {
  title: "My account & order tracking",
  description: "Track your Designer Clothing order, download your invoice or get help on WhatsApp.",
  robots: { index: true, follow: true },
};

const helpLinks = [
  { label: "Size guide", href: "/pages/size-guide" },
  { label: "Shipping & delivery", href: "/policies/shipping-policy" },
  { label: "Returns & refunds", href: "/policies/refund-and-return-policy" },
  { label: "Contact us", href: "/pages/contact" },
];

export default function AccountPage() {
  return (
    <div className="container-liksha py-10 lg:py-14">
      <div className="mx-auto max-w-[900px]">
        <div className="text-center">
          <h1 className="font-display text-[30px] font-medium tracking-[.03em] sm:text-[36px]">
            Track your order
          </h1>
          <p className="mt-1 text-[11px] tracking-[.14em] text-[#9c8f82] uppercase">
            Order number WhatsApp par milta hai
          </p>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <div className="border border-[#eee6de] bg-[#faf8f5] p-5 sm:p-6">
            <h2 className="text-[11px] font-semibold tracking-[.16em] text-[#862222] uppercase">
              Order status
            </h2>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[#6b6259]">
              Apna order number daal kar live status, items aur delivery address dekh lein.
            </p>
            <TrackOrderForm />
            {/* R45: number sirf sheet se — khali ho to line dikhti hi nahi */}
            <WhatsAppHelpLine label="Order number nahi mila? WhatsApp" className="mt-3" />
          </div>

          <div className="border border-[#eee6de] p-5 sm:p-6">
            <h2 className="text-[11px] font-semibold tracking-[.16em] text-[#862222] uppercase">
              Need help?
            </h2>
            <ul className="mt-3 space-y-2">
              {helpLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-[12.5px] text-[#5c534b] hover:text-[#862222]">
                    {link.label} →
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-[#f0eae3] pt-3 text-[12px] text-[#6b6259]">
              {/* R45: email site par nahi (owner rule); phone/WhatsApp sirf sheet se — khali to line gayab */}
              <WhatsAppHelpLine label="WhatsApp:" />
              <p className="mt-1 text-[11px] text-[#8a8078]">
                Account login (saved addresses, wishlist) Phase 2 me aa raha hai.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
