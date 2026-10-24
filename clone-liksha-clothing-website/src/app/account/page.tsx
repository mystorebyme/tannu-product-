import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <div className="container-liksha py-10 lg:py-14">
      <div className="mx-auto max-w-[900px]">
        <div className="text-center">
          <h1 className="font-display text-[30px] font-medium tracking-[.03em] sm:text-[36px]">My account</h1>
          <p className="mt-1 text-[11px] tracking-[.14em] text-[#9c8f82] uppercase">
            Log in to track orders and save your favourites
          </p>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <form className="border border-[#eee6de] bg-[#faf8f5] p-5 sm:p-6">
            <h2 className="text-[11px] font-semibold tracking-[.16em] text-[#862222] uppercase">Login</h2>
            <input
              type="email"
              placeholder="Email"
              className="mt-3 h-11 w-full border border-[#ddd2c6] bg-white px-3 text-[13px] outline-none focus:border-[#862222]"
            />
            <input
              type="password"
              placeholder="Password"
              className="mt-2.5 h-11 w-full border border-[#ddd2c6] bg-white px-3 text-[13px] outline-none focus:border-[#862222]"
            />
            <button
              type="button"
              className="mt-3 w-full bg-[#862222] py-3 text-[11px] font-semibold tracking-[.16em] text-white uppercase"
            >
              Sign in
            </button>
            <p className="mt-2 text-center text-[10.5px] text-[#8a8078]">
              Account login is coming soon. Check out as a guest — your order details are sent by email
              and WhatsApp.
            </p>
          </form>

          <div className="border border-[#eee6de] bg-[#faf8f5] p-5 sm:p-6">
            <h2 className="text-[11px] font-semibold tracking-[.16em] text-[#862222] uppercase">Track an order</h2>
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-[#5c534b]">
              Open the confirmation link shared on WhatsApp, or message us your order number and we will
              share live tracking instantly.
            </p>
            <Link
              href="/pages/contact"
              className="mt-4 block border border-[#862222] py-3 text-center text-[11px] font-semibold tracking-[.16em] text-[#862222] uppercase"
            >
              Contact support
            </Link>
            <a
              href="https://wa.me/919909790455"
              target="_blank"
              rel="noreferrer"
              className="mt-2 block bg-[#222] py-3 text-center text-[11px] font-semibold tracking-[.16em] text-white uppercase"
            >
              WhatsApp 9909790455
            </a>
            <p className="mt-3 text-center text-[11px] text-[#8a8078]">7 days replacement on every order</p>
          </div>
        </div>

        <div className="mt-7 grid gap-2.5 sm:grid-cols-3">
          {[
            { label: "New Arrivals", href: "/collections/new-arrivals" },
            { label: "Anarkali Suits", href: "/collections/party-wear-gown" },
            { label: "Lehenga Choli", href: "/collections/lehnga-choli" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="border border-[#eee6de] py-3 text-center text-[11px] font-semibold tracking-[.14em] uppercase hover:border-[#862222] hover:text-[#862222]"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
