"use client";

import Link from "next/link";
import { useState } from "react";
import { SafeImage } from "@/components/safe-image";
import { logoWhiteUrl, logoFallback } from "@/config/site";

/**
 * Footer — live store (likshaclothing.com) ka same structure:
 * dark maroon band (#8a000e), white wordmark, Contact Us / Follow Us /
 * CUSTMORE SUPPORT / Menu columns, phir copyright strip.
 */

const supportLinks = [
  { label: "Search", href: "/search" },
  { label: "Privacy Policy", href: "/policies/privacy-policy" },
  { label: "Replacement Policy", href: "/policies/refund-and-return-policy" },
  { label: "Shipping Policy", href: "/policies/shipping-policy" },
  { label: "Contact Information", href: "/pages/contact" },
  { label: "About Us", href: "/pages/about-us" },
  { label: "Terms and Conditions", href: "/policies/terms-and-conditions" },
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
    <footer className="mt-16 bg-[#8a000e] text-white">
      <div className="mx-auto max-w-[1400px] px-4 pt-11 pb-8 lg:px-6">
        <div className="flex flex-col items-center">
          <Link href="/" aria-label="Liksha Clothing home">
            <SafeImage
              src={logoWhiteUrl}
              fallbackSrc={logoFallback}
              alt="Liksha Clothing"
              className="h-20 w-auto object-contain sm:h-24"
            />
          </Link>
        </div>

        <div className="mt-9 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {/* Contact us */}
          <div>
            <h3 className="text-[15px] font-medium text-white">Contact Us</h3>
            <ul className="mt-4 space-y-2.5 text-[13.5px] text-[#ececec]">
              <li className="flex items-start gap-2">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" className="mt-0.5 shrink-0" aria-hidden>
                  <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
                </svg>
                <span>Please contact On WhatsApp 9909790455</span>
              </li>
              <li className="flex items-start gap-2">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" className="mt-0.5 shrink-0" aria-hidden>
                  <path d="M2 5.5 12 12l10-6.5V19a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5.5Z" />
                </svg>
                <a href="mailto:info.likshaclothing@gmail.com" className="transition hover:text-[#e1d256]">
                  info.likshaclothing@gmail.com
                </a>
              </li>
              <li className="flex items-start gap-2">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" className="mt-0.5 shrink-0" aria-hidden>
                  <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.4 0 .7-.2 1l-2.3 2.2Z" />
                </svg>
                <a href="tel:+919879219630" className="transition hover:text-[#e1d256]">
                  +91 9879219630
                </a>
              </li>
            </ul>

            <p className="mt-5 text-[15px] font-medium text-white">Follow Us :</p>
            <div className="mt-3 flex items-center gap-2.5">
              {socials.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/35 text-white transition hover:border-[#e1d256] hover:text-[#e1d256]"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    {social.icon}
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* Customer support */}
          <div>
            <h3 className="text-[15px] font-medium text-white">CUSTMORE SUPPORT</h3>
            <ul className="mt-4 space-y-2.5 text-[13.5px] text-[#ececec]">
              {supportLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition hover:text-[#e1d256]">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Menu */}
          <div>
            <h3 className="text-[15px] font-medium text-white">Menu</h3>
            <ul className="mt-4 space-y-2.5 text-[13.5px] text-[#ececec]">
              {menuLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition hover:text-[#e1d256]">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="text-[15px] font-medium text-white">Get 10% off</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[#f1dede]">
              Join the Liksha list for early access to new drops and festive offers.
            </p>
            <form onSubmit={subscribe} className="mt-3">
              <div className="flex border border-white/40 bg-white">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Your email"
                  aria-label="Email address"
                  className="h-10 w-full bg-transparent px-2.5 text-[12.5px] text-[#2f2a25] outline-none"
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="bg-[#222] px-3.5 text-[10.5px] font-semibold tracking-[.12em] text-white uppercase disabled:opacity-60"
                >
                  Join
                </button>
              </div>
              {status === "done" ? (
                <p className="mt-1.5 text-[11.5px] text-[#d9f0d9]">You&apos;re in! Use code LIKSHA10 at checkout.</p>
              ) : null}
              {status === "error" ? (
                <p className="mt-1.5 text-[11.5px] text-[#ffd6cf]">Please try again.</p>
              ) : null}
            </form>

            <div className="mt-5 space-y-1.5 text-[13px] text-[#ececec]">
              <p>
                <Link href="/wishlist" className="transition hover:text-[#e1d256]">
                  My Wishlist
                </Link>
              </p>
              <p>
                <Link href="/compare" className="transition hover:text-[#e1d256]">
                  Compare Products
                </Link>
              </p>
              <p>
                <Link href="/pages/track-order" className="transition hover:text-[#e1d256]">
                  Track your order
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/20">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-2 px-4 py-4 text-[11.5px] text-[#f3e2e2] sm:flex-row lg:px-6">
          <p>© {new Date().getFullYear()}, Liksha Clothing. All rights reserved.</p>
          <p className="text-[10.5px] tracking-[.1em] uppercase">Secure prepaid payments</p>
        </div>
      </div>
    </footer>
  );
}
