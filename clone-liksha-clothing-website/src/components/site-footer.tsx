"use client";

import Link from "next/link";
import { useState } from "react";

const supportLinks = [
  { label: "Search", href: "/search" },
  { label: "Privacy Policy", href: "/pages/privacy-policy" },
  { label: "Replacement Policy", href: "/pages/replacement-policy" },
  { label: "Shipping Policy", href: "/pages/shipping-policy" },
  { label: "Contact Information", href: "/pages/contact" },
  { label: "About Us", href: "/pages/about-us" },
  { label: "Terms and Conditions", href: "/pages/terms-and-conditions" },
];

const menuLinks = [
  { label: "HOME", href: "/" },
  { label: "LIKSHA'S CHOICE", href: "/collections/likshas-choice" },
  { label: "ANARKALI SUIT", href: "/collections/party-wear-gown" },
  { label: "LEHENGA CHOLI", href: "/collections/lehnga-choli" },
  { label: "PRINTED SUIT SET", href: "/collections/printed-suit-set" },
  { label: "SALE", href: "/collections/sale" },
  { label: "SAREES", href: "/collections/saree" },
  { label: "WEDDING COLLECTION", href: "/collections/weddin-collection" },
];

const socials = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/likshaclothing/",
    icon: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <path d="M17.5 6.5h.01" />
      </>
    ),
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/",
    icon: <path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v6h3v-6h3l1-3h-4v-2c0-.6.4-1 1-1Z" />,
  },
  {
    label: "WhatsApp",
    href: "https://wa.me/919909790455",
    icon: (
      <>
        <path d="M20 12a8 8 0 0 1-11.7 7.1L4 20l1-4.2A8 8 0 1 1 20 12Z" />
        <path d="M9 9c.5 3 2.5 5 5.5 5.5" />
      </>
    ),
  },
  {
    label: "Pinterest",
    href: "https://www.pinterest.com/",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M10 20l2-7M9 10c0-2 1.6-3.5 3.6-3.5 2.2 0 3.4 1.3 3.4 3.2 0 2.4-1.4 4.3-3.1 4.3-.9 0-1.6-.6-1.4-1.5" />
      </>
    ),
  },
];

export function SiteFooter() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function subscribe(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setStatus(response.ok ? "done" : "error");
      if (response.ok) setEmail("");
    } catch {
      setStatus("error");
    }
  }

  return (
    <footer className="mt-16 border-t border-[#e9dfd4] bg-[#faf6f1] text-[#3f3830]">
      <div className="border-b border-[#e9dfd4]">
        <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-y-6 px-4 py-7 sm:grid-cols-4 lg:px-6">
          {[
            { title: "FREE SHIPPING", text: "Free shipping on all order across India", icon: "shipping" },
            { title: "SUPPORT 24/7", text: "Contact us 24 hours a day, 7 days a week", icon: "support" },
            { title: "7 DAYS REPLACEMENT", text: "Simply return it within 7 days for an exchange.", icon: "replacement" },
            { title: "100% SECURE PAYMENT", text: "We ensure secure payment", icon: "secure" },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3 px-1">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d9c6b4] text-[#862222]">
                {item.icon === "shipping" ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 7h11v9H2zM13 10h5l3 3v3h-8" />
                    <circle cx="6" cy="18" r="1.6" />
                    <circle cx="17" cy="18" r="1.6" />
                  </svg>
                ) : item.icon === "support" ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 13a8 8 0 0 1 16 0v4a3 3 0 0 1-3 3h-2" />
                    <rect x="2" y="12" width="4" height="6" rx="1.5" />
                    <rect x="18" y="12" width="4" height="6" rx="1.5" />
                  </svg>
                ) : item.icon === "replacement" ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5" />
                    <path d="M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 3l8 3v6c0 4.4-3.4 7.9-8 9-4.6-1.1-8-4.6-8-9V6l8-3Z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                )}
              </span>
              <div>
                <h3 className="text-[10.5px] font-semibold tracking-[.12em] text-[#862222] uppercase">{item.title}</h3>
                <p className="mt-1 text-[11.5px] leading-relaxed text-[#6b6259]">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-11 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
        <div>
          <Link href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/site/logo.png" alt="Liksha Clothing" className="h-16 w-auto" />
          </Link>
          <p className="mt-3 max-w-[280px] text-[12px] leading-relaxed text-[#6b6259]">
            Liksha Clothing brings you hand-finished designer Anarkali suits, lehengas and suit sets —
            crafted for weddings, festivals and every celebration in between.
          </p>
        </div>

        <div>
          <h4 className="text-[12px] font-semibold tracking-[.14em] text-[#862222] uppercase">Contact Us</h4>
          <p className="mt-3 text-[12px] leading-relaxed">Please contact On</p>
          <a
            href="https://wa.me/919909790455"
            className="mt-1 block text-[12px] font-medium text-[#3f3830] hover:text-[#862222]"
          >
            WhatsApp 9909790455
          </a>
          <a href="mailto:Info.likshaclothing@gmail.com" className="mt-1 block text-[12px] hover:text-[#862222]">
            Info.likshaclothing@gmail.com
          </a>
          <a href="tel:+919879219630" className="mt-1 block text-[12px] hover:text-[#862222]">
            +91 9879219630
          </a>
          <p className="mt-4 text-[11.5px] font-semibold tracking-[.12em] uppercase">Follow Us :</p>
          <div className="mt-2 flex items-center gap-2">
            {socials.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noreferrer"
                aria-label={social.label}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#d9c6b4] text-[#862222] transition hover:bg-[#862222] hover:text-white"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  {social.icon}
                </svg>
              </a>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-[12px] font-semibold tracking-[.14em] text-[#862222] uppercase">Customer Support</h4>
          <ul className="mt-3 space-y-2">
            {supportLinks.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="text-[12px] text-[#6b6259] transition hover:text-[#862222]">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-[12px] font-semibold tracking-[.14em] text-[#862222] uppercase">Menu</h4>
          <ul className="mt-3 space-y-2">
            {menuLinks.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="text-[12px] tracking-[.04em] text-[#6b6259] transition hover:text-[#862222]"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <form onSubmit={subscribe} className="mt-5">
            <label className="text-[10.5px] font-semibold tracking-[.14em] uppercase">Get 10% off</label>
            <div className="mt-1.5 flex border border-[#d9c6b4] bg-white">
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Your email"
                className="h-9 w-full bg-transparent px-2.5 text-[12px] outline-none"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="bg-[#862222] px-3 text-[10px] font-semibold tracking-[.12em] text-white uppercase disabled:opacity-60"
              >
                Join
              </button>
            </div>
            {status === "done" ? (
              <p className="mt-1.5 text-[11px] text-[#2f7a3f]">You&apos;re in! Use code LIKSHA10 at checkout.</p>
            ) : null}
            {status === "error" ? (
              <p className="mt-1.5 text-[11px] text-[#b3261e]">Please try again.</p>
            ) : null}
          </form>
        </div>
      </div>

      <div className="border-t border-[#e9dfd4]">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-2 px-4 py-4 text-[11px] text-[#8a8078] sm:flex-row lg:px-6">
          <p>© {new Date().getFullYear()}, Liksha Clothing. All rights reserved.</p>
          <p className="flex items-center gap-3">
            <span>Visa</span>
            <span>Mastercard</span>
            <span>UPI</span>
            <span>Rupay</span>
            <span>Cash on Delivery</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
