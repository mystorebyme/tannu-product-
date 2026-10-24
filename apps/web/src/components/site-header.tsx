"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { navigationCollections } from "@/lib/collections";
import { formatPrice, imageUrl } from "@/lib/format";
import { useCart } from "@/components/cart-provider";
import type { SearchHit } from "@/types/catalog";
import { SafeImage } from "@/components/safe-image";

const quickLinks = [
  { label: "HOME", href: "/" },
  { label: "ANARKALI SUIT", href: "/collections/party-wear-gown" },
  { label: "LIKSHA'S CHOICE", href: "/collections/likshas-choice" },
  { label: "NEW ARRIVALS", href: "/collections/new-arrivals" },
  { label: "LEHNGA CHOLI", href: "/collections/lehnga-choli" },
  { label: "PRINTED SUIT SET", href: "/collections/printed-suit-set" },
  { label: "TRENDING", href: "/collections/trending" },
  { label: "SALE", href: "/collections/sale" },
  { label: "WEDDING COLLECTION", href: "/collections/weddin-collection" },
];

// Diwali 2026 (8 Nov) dispatch window — season ke baad update karein
const announcements = [
  "Diwali dispatch ✦ order by 4 Nov for delivery before the festival",
  "Free shipping across India — every order",
  "COD available up to Rs. 3,500",
  "Same-day dispatch on prepaid orders",
];

export function SiteHeader() {
  const { count, openCart, lines, removeLine, setQuantity, subtotal } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [bannerIndex, setBannerIndex] = useState(0);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const [results, setResults] = useState<SearchHit[]>([]);

  // search server par hoti hai -> client bundle me 400KB ka catalog nahi jaata
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : { results: [] }))
        .then((payload: { results?: SearchHit[] }) => setResults(payload.results ?? []))
        .catch(() => undefined);
    }, 220);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const submitSearch = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      if (!query.trim()) return;
      setSearchOpen(false);
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    },
    [query, router],
  );

  return (
    <>
      <div className="bg-[#862222] text-white">
        <div className="mx-auto flex h-9 max-w-[1400px] items-center justify-center px-4">
          <p key={bannerIndex} className="animate-[fadeIn_.5s_ease] text-center text-[10.5px] tracking-[.12em] uppercase sm:text-[11.5px]">
            {announcements[bannerIndex]}
          </p>
          <div className="ml-4 hidden items-center gap-2 sm:flex">
            {announcements.map((item, index) => (
              <button
                key={item}
                type="button"
                aria-label={`Announcement ${index + 1}`}
                onClick={() => setBannerIndex(index)}
                className={`h-1.5 w-1.5 rounded-full transition ${bannerIndex === index ? "bg-white" : "bg-white/40"}`}
              />
            ))}
          </div>
        </div>
      </div>

      <header
        className={`sticky top-0 z-40 border-b border-[#e9e2da] bg-white transition-shadow ${
          scrolled ? "shadow-[0_6px_24px_rgba(0,0,0,0.08)]" : ""
        }`}
      >
        <div className="mx-auto flex h-[62px] max-w-[1400px] items-center justify-between gap-3 px-4 lg:h-[76px] lg:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            data-testid="mobile-menu"
            className="flex h-9 w-9 items-center justify-center lg:hidden"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>

          <Link href="/" className="flex shrink-0 items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/site/logo.svg"
              alt="Liksha Clothing"
              className="h-10 w-auto object-contain sm:h-12 lg:h-14"
            />
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-6 lg:flex xl:gap-8">
            {quickLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative whitespace-nowrap py-2 text-[12px] font-medium tracking-[.1em] transition-colors hover:text-[#862222] ${
                    active ? "text-[#862222]" : "text-[#222]"
                  }`}
                >
                  {link.label}
                  {link.label === "SALE" ? (
                    <span className="absolute -right-3 -top-0.5 rounded-sm bg-[#e02020] px-1 text-[8px] leading-[12px] font-bold text-white">
                      HOT
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen((open) => !open)}
              aria-label="Search"
              data-testid="header-search"
              className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#f6f1ec] hover:text-[#862222]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </button>
            <Link
              href="/account"
              aria-label="Account"
              className="hidden h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#f6f1ec] hover:text-[#862222] sm:flex"
            >
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
              </svg>
            </Link>
            <button
              type="button"
              onClick={openCart}
              aria-label="Open cart"
              data-testid="header-cart"
              className="relative flex h-9 items-center gap-1.5 px-1.5 transition hover:text-[#862222]"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M6 7h12l1.2 13H4.8L6 7Z" />
                <path d="M9 7a3 3 0 0 1 6 0" />
              </svg>
              <span data-testid="cart-count" className="hidden text-[11px] font-medium tabular-nums sm:inline">
                {count} / {formatPrice(subtotal)}
              </span>
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#862222] px-1 text-[9px] font-semibold text-white sm:hidden">
                {count}
              </span>
            </button>
          </div>
        </div>

        {searchOpen ? (
          <div className="border-t border-[#eee6de] bg-white px-4 py-4 shadow-sm">
            <form onSubmit={submitSearch} className="mx-auto max-w-[760px]">
              <div className="flex items-center gap-2 border border-[#d9cec3] px-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  autoFocus
                  data-testid="search-input"
                  aria-label="Search products"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search for anarkali suits, lehenga, printed suits…"
                  className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-[#9c9289]"
                />
                <button type="submit" className="text-[11px] font-semibold tracking-[.14em] uppercase text-[#862222]">
                  Search
                </button>
              </div>
              {results.length > 0 ? (
                <ul className="mt-3 divide-y divide-[#f0eae3] border border-[#f0eae3]">
                  {results.map((product) => (
                    <li key={product.handle}>
                      <Link
                        href={`/products/${product.handle}`}
                        className="flex items-center gap-3 p-2 hover:bg-[#faf7f3]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <SafeImage src={imageUrl(product.images[0], 160)} alt={product.title} className="h-14 w-12 object-cover" />
                        <span className="flex-1 text-xs font-medium">{product.title}</span>
                        <span className="text-xs text-[#862222]">{formatPrice(product.price)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </form>
          </div>
        ) : null}
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-[340px] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#eee6de] px-4 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/site/logo.svg" alt="Liksha Clothing" className="h-10 w-auto" />
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close" className="p-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M5 5l14 14M19 5 5 19" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between border-b border-[#f4efe9] px-5 py-3.5 text-[12.5px] font-medium tracking-[.09em]"
                >
                  {link.label}
                  {link.label === "SALE" ? (
                    <span className="rounded-sm bg-[#e02020] px-1.5 py-0.5 text-[9px] font-bold text-white">HOT</span>
                  ) : (
                    <span className="text-[#c4b8ac]">›</span>
                  )}
                </Link>
              ))}
              <div className="px-5 py-4">
                <p className="mb-2 text-[11px] tracking-[.16em] text-[#9c9289] uppercase">Collections</p>
                <div className="flex flex-wrap gap-2">
                  {navigationCollections.slice(0, 6).map((collection) => (
                    <Link
                      key={collection.handle}
                      href={`/collections/${collection.handle}`}
                      className="border border-[#e5dbd0] px-2.5 py-1 text-[11px]"
                    >
                      {collection.title}
                    </Link>
                  ))}
                </div>
              </div>
            </nav>
            <div className="border-t border-[#eee6de] px-5 py-4 text-[11.5px] text-[#5c534b]">
              <p className="font-medium text-[#862222]">Info.likshaclothing@gmail.com</p>
              <p className="mt-1">WhatsApp 9909790455 · +91 9879219630</p>
            </div>
          </div>
        </div>
      ) : null}

      <CartDrawer
        count={count}
        subtotal={subtotal}
        lines={lines}
        removeLine={removeLine}
        setQuantity={setQuantity}
      />
    </>
  );
}

function CartDrawer({
  count,
  subtotal,
  lines,
  removeLine,
  setQuantity,
}: {
  count: number;
  subtotal: number;
  lines: ReturnType<typeof useCart>["lines"];
  removeLine: (key: string) => void;
  setQuantity: (key: string, quantity: number) => void;
}) {
  const { isOpen, closeCart } = useCart();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50" data-testid="cart-drawer" role="dialog" aria-modal="true" aria-label="Cart">
      <button type="button" aria-label="Close cart" onClick={closeCart} className="absolute inset-0 bg-black/45" />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#eee6de] px-5 py-4">
          <h2 className="text-[13px] font-semibold tracking-[.16em] uppercase">Your cart ({count})</h2>
          <button type="button" onClick={closeCart} aria-label="Close cart" className="p-1.5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M5 5l14 14M19 5 5 19" />
            </svg>
          </button>
        </div>
        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-sm text-[#6b6259]">Your cart is empty.</p>
            <Link
              href="/collections/party-wear-gown"
              onClick={closeCart}
              className="bg-[#862222] px-6 py-3 text-[11px] font-semibold tracking-[.16em] text-white uppercase"
            >
              Shop Anarkali Suits
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5">
              {lines.map((line) => (
                <div key={line.key} className="flex gap-3 border-b border-[#f1ebe5] py-4">
                  <Link href={`/products/${line.handle}`} onClick={closeCart} className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <SafeImage src={line.image} alt={line.title} className="h-24 w-20 object-cover" />
                  </Link>
                  <div className="flex flex-1 flex-col">
                    <Link
                      href={`/products/${line.handle}`}
                      onClick={closeCart}
                      className="text-[12.5px] font-medium leading-snug hover:text-[#862222]"
                    >
                      {line.title}
                    </Link>
                    <p className="mt-0.5 text-[11px] text-[#8a8078]">Size: {line.size}</p>
                    <p className="mt-1 text-[12.5px] font-semibold text-[#862222]">{formatPrice(line.price)}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center border border-[#e2d8cd]">
                        <button
                          type="button"
                          onClick={() => setQuantity(line.key, line.quantity - 1)}
                          className="h-7 w-7 text-sm"
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="w-7 text-center text-xs">{line.quantity}</span>
                        <button
                          type="button"
                          onClick={() => setQuantity(line.key, line.quantity + 1)}
                          className="h-7 w-7 text-sm"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLine(line.key)}
                        className="text-[10.5px] tracking-[.08em] text-[#9a8f85] uppercase underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-[#eee6de] px-5 py-4">
              <div className="flex items-center justify-between text-sm">
                <span className="tracking-[.1em] uppercase">Subtotal</span>
                <span className="font-semibold text-[#862222]">{formatPrice(subtotal)}</span>
              </div>
              <p className="mt-1 text-[11px] text-[#8a8078]">
                {subtotal >= 350000
                  ? "Free shipping & COD eligible 🎉"
                  : `COD available under Rs. 3,500 — advance payment required above it.`}
              </p>
              <Link
                href="/cart"
                onClick={closeCart}
                className="mt-3 block border border-[#862222] py-3 text-center text-[11px] font-semibold tracking-[.16em] text-[#862222] uppercase"
              >
                View cart
              </Link>
              <Link
                href="/checkout"
                onClick={closeCart}
                className="mt-2 block bg-[#862222] py-3 text-center text-[11px] font-semibold tracking-[.16em] text-white uppercase"
              >
                Checkout
              </Link>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
