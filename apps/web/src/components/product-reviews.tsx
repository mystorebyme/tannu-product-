"use client";

import { useEffect, useMemo, useState } from "react";
import { SafeImage } from "@/components/safe-image";
import { Stars } from "@/components/stars";
import { productUrl } from "@/lib/whatsapp";
import { ratingBreakdown, type ProductReviewBlock, type Review } from "@/lib/reviews";
import { readCheckoutDetails } from "@/lib/checkout-details";
import { useStoreSettings } from "@/components/store-settings-provider";
import { whatsappNumber } from "@/lib/phone";

/**
 * Product reviews — live store ke Trustoo widget jaisa layout:
 * bada average + stars, 5★→1★ distribution bars, photo reviews ka carousel,
 * aur verified buyer review cards. Data daily sync se aata hai.
 */
export function ProductReviews({
  block,
  productTitle,
  productHandle,
}: {
  block: ProductReviewBlock;
  productTitle: string;
  productHandle: string;
}) {
  const { whatsapp } = useStoreSettings();
  const [filter, setFilter] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const breakdown = useMemo(() => ratingBreakdown(block), [block]);
  const photos = useMemo(
    () => block.reviews.flatMap((review) => (review.photos ?? []).map((src) => ({ src, review }))),
    [block],
  );
  const visible = filter ? block.reviews.filter((review) => Math.round(review.rating) === filter) : block.reviews;

  const wa = whatsapp.replace(/\D/g, "").slice(-10);
  const whatsappReview = `https://wa.me/${whatsappNumber(wa)}?text=${encodeURIComponent(
    `Hi Designer Clothing! I'd like to review "${productTitle}" (${productUrl(productHandle)}). My rating: `,
  )}`;

  return (
    <section className="mt-10 border-t border-[#eee6de] pt-8" data-testid="product-reviews" id="reviews">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[24px] font-medium sm:text-[28px]">Customer reviews</h2>
          <p className="mt-1 text-[11px] tracking-[.12em] text-[#9c8f82] uppercase">
            {block.count > 0 ? `${block.count} customer reviews` : "Be the first to review this piece"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((current) => !current)}
          className="border border-[#862222] px-5 py-2.5 text-[10.5px] font-semibold tracking-[.14em] text-[#862222] uppercase transition hover:bg-[#862222] hover:text-white"
        >
          Write a review
        </button>
      </div>

      {showForm ? (
        <div className="mt-3 border border-[#eee6de] bg-[#faf8f5] p-4">
          {/*
            R44 (owner): naya review site par hi likha jaata hai → sheet ke
            Reviews tab me `pending` jaata hai → owner approve karte hi live.
            Photos: customer web par image upload karke link paste karta hai
            (max 8 — sheet me Image 1…8 alag columns).
          */}
          <ReviewForm productHandle={productHandle} />
          {/* R45: number sheet se khali ho to WhatsApp line dikhti hi nahi */}
          {whatsappNumber(wa) ? (
            <p className="mt-3 text-[11.5px] leading-relaxed text-[#8a8078]">
              Ya{" "}
              <a href={whatsappReview} target="_blank" rel="noopener noreferrer" className="font-medium text-[#862222] underline">
                WhatsApp par review bhejiye
              </a>{" "}
              — team publish kar degi.
            </p>
          ) : null}
        </div>
      ) : null}

      {block.count === 0 ? (
        <div className="mt-5 border border-[#eee6de] px-5 py-10 text-center">
          <Stars value={0} size={18} />
          <p className="mt-2 text-[12.5px] text-[#6b6259]">
            Is piece par abhi koi review nahi hai. Pehla review aapka ho sakta hai.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-6 border border-[#eee6de] p-5 sm:grid-cols-[210px_1fr]">
            <div className="text-center sm:border-r sm:border-[#f1ebe5] sm:pr-5">
              {block.rating > 0 ? (
                <>
                  <p className="font-display text-[44px] leading-none text-[#862222]">{block.rating.toFixed(1)}</p>
                  <Stars value={block.rating} size={16} />
                </>
              ) : (
                <p className="font-display text-[20px] leading-none text-[#862222]">{block.count} ratings</p>
              )}
              <p className="mt-1.5 text-[11.5px] text-[#6b6259]">Based on {block.count} reviews</p>
            </div>
            <div className="space-y-1.5">
              {block.reviews.length === 0 ? (
                <p className="text-[12px] leading-relaxed text-[#6b6259]">
                  Is piece par {block.count} ratings hain. Customer-written reviews aate hi yahan dikhte hain —
                  koi sample review publish nahi hota.
                </p>
              ) : null}
              {block.reviews.length === 0 ? null : breakdown.map((row) => (
                <button
                  key={row.stars}
                  type="button"
                  onClick={() => setFilter(filter === row.stars ? null : row.stars)}
                  className={`flex w-full items-center gap-2 text-left text-[11.5px] transition ${
                    filter === row.stars ? "text-[#862222]" : "text-[#6b6259] hover:text-[#862222]"
                  }`}
                >
                  <span className="w-7">{row.stars}★</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#f1ebe5]">
                    <span className="block h-full rounded-full bg-[#c9a86a]" style={{ width: `${row.percent}%` }} />
                  </span>
                  <span className="w-8 text-right tabular-nums">{row.count}</span>
                </button>
              ))}
              {filter ? (
                <button
                  type="button"
                  onClick={() => setFilter(null)}
                  className="text-[10.5px] tracking-[.1em] text-[#862222] uppercase underline"
                >
                  Clear filter
                </button>
              ) : null}
            </div>
          </div>

          {photos.length > 0 ? (
            <div className="mt-6">
              <p className="text-[10.5px] font-semibold tracking-[.14em] text-[#8a8078] uppercase">Customer photos</p>
              <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
                {photos.map(({ src, review }) => (
                  <figure key={`${review.id}-${src}`} className="w-[104px] shrink-0">
                    <SafeImage src={src} alt="" className="h-[132px] w-full object-cover" />
                    <figcaption className="mt-1 text-[10px] text-[#8a8078]">{review.author}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          ) : null}

          <ul className="mt-6 space-y-4">
            {visible.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/**
 * R44: customer ka review form — submit hote hi sheet ke Reviews tab me
 * `pending` row banti hai; owner approve karte hi product page par live.
 * Photos image-URL paste se (web par upload karke link) — max 8, sheet me
 * Image 1…8 alag columns me jaate hain.
 */
function ReviewForm({ productHandle }: { productHandle: string }) {
  const [form, setForm] = useState({ name: "", city: "", rating: 5, title: "", body: "", images: [] as string[] });
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  // checkout me save hui details se prefill (R36 pattern — customer ko dobara na likhna pade)
  useEffect(() => {
    const details = readCheckoutDetails();
    if (!details) return;
    setForm((current) => ({
      ...current,
      name: current.name || String(details.customerName ?? ""),
      city: current.city || String(details.city ?? ""),
    }));
  }, []);

  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (state === "sending") return;
    setState("sending");
    setMessage("");
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          handle: productHandle,
          name: form.name,
          city: form.city,
          rating: form.rating,
          title: form.title,
          body: form.body,
          images: form.images.map((image) => image.trim()).filter(Boolean),
        }),
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string } | null;
      if (response.ok && data?.ok) {
        setState("done");
        setMessage(data.message ?? "Shukriya! Review approve hote hi dikhne lagega.");
      } else {
        setState("error");
        setMessage(data?.error ?? "Review submit nahi ho paya — dobara try kijiye.");
      }
    } catch {
      setState("error");
      setMessage("Review submit nahi ho paya — dobara try kijiye.");
    }
  }

  if (state === "done") {
    return (
      <p data-testid="review-form-success" className="border border-[#dcebdd] bg-[#f2f8f3] p-4 text-[12.5px] leading-relaxed text-[#2f7a3f]">
        {message}
      </p>
    );
  }

  const field = "w-full border border-[#e2d8cc] bg-white px-3 py-2 text-[12.5px] text-[#3d352e] outline-none focus:border-[#862222]";
  const label = "block text-[10.5px] font-semibold uppercase tracking-[.12em] text-[#9c8f82] mb-1";
  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2" data-testid="review-form">
      <div>
        <label className={label} htmlFor="review-name">Naam *</label>
        <input id="review-name" data-testid="review-name" className={field} value={form.name} onChange={(event) => set({ name: event.target.value })} required minLength={2} maxLength={60} placeholder="Aapka naam" />
      </div>
      <div>
        <label className={label} htmlFor="review-city">City</label>
        <input id="review-city" data-testid="review-city" className={field} value={form.city} onChange={(event) => set({ city: event.target.value })} maxLength={60} placeholder="Jaipur" />
      </div>
      <div>
        <label className={label} htmlFor="review-rating">Rating *</label>
        <select id="review-rating" data-testid="review-rating" className={field} value={form.rating} onChange={(event) => set({ rating: Number(event.target.value) })}>
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>{value} ★</option>
          ))}
        </select>
      </div>
      <div>
        <label className={label} htmlFor="review-title">Title</label>
        <input id="review-title" data-testid="review-title" className={field} value={form.title} onChange={(event) => set({ title: event.target.value })} maxLength={140} placeholder="Bahut accha product" />
      </div>
      <div className="sm:col-span-2">
        <label className={label} htmlFor="review-body">Review *</label>
        <textarea id="review-body" data-testid="review-body" className={field} rows={4} value={form.body} onChange={(event) => set({ body: event.target.value })} required minLength={10} maxLength={4000} placeholder="Product kaisa laga — fabric, fitting, colour…" />
      </div>
      <div className="sm:col-span-2">
        <span className={label}>Photos (image ka link paste karein — max 8)</span>
        <div className="grid gap-2">
          {form.images.map((image, index) => (
            <div key={index} className="flex gap-2">
              <input
                data-testid={`review-image-${index}`}
                className={field}
                value={image}
                onChange={(event) => {
                  const next = [...form.images];
                  next[index] = event.target.value;
                  set({ images: next });
                }}
                placeholder="https://…"
                inputMode="url"
              />
              <button type="button" onClick={() => set({ images: form.images.filter((_, i) => i !== index) })} className="shrink-0 border border-[#e2d8cc] px-3 text-[11px] text-[#8a8078] hover:border-[#862222] hover:text-[#862222]">
                Hatao
              </button>
            </div>
          ))}
          {form.images.length < 8 ? (
            <button type="button" data-testid="review-image-add" onClick={() => set({ images: [...form.images, ""] })} className="w-fit border border-dashed border-[#c9bcae] px-3 py-1.5 text-[11px] font-medium text-[#862222]">
              + Image link add karein
            </button>
          ) : null}
        </div>
      </div>
      <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
        <button type="submit" data-testid="review-submit" disabled={state === "sending"} className="bg-[#862222] px-6 py-2.5 text-[11px] font-semibold uppercase tracking-[.14em] text-white disabled:opacity-60">
          {state === "sending" ? "Bhej rahe hain…" : "Review bhejein"}
        </button>
        {state === "error" && message ? (
          <p data-testid="review-form-error" className="text-[12px] text-[#a04a32]">{message}</p>
        ) : null}
        <p className="text-[11px] text-[#9c8f82]">Approve hote hi aapka review product page par dikhega.</p>
      </div>
    </form>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <li className="border border-[#eee6de] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] font-medium">{review.author}</span>
        {review.verified === true ? (
          <span className="bg-[#eaf5ec] px-1.5 py-0.5 text-[9px] font-semibold tracking-[.08em] text-[#2f7a3f] uppercase">
            Verified buyer
          </span>
        ) : null}
        {review.date ? <span className="text-[10.5px] text-[#9c8f82]">{review.date}</span> : null}
      </div>
      <div className="mt-1.5">
        <Stars value={review.rating} size={13} />
      </div>
      {review.title ? <p className="mt-1.5 text-[12.5px] font-medium">{review.title}</p> : null}
      <p className="mt-1 text-[12.5px] leading-relaxed text-[#5c534b]">{review.body}</p>
      {review.photos?.length ? (
        <div className="mt-2 flex gap-1.5">
          {review.photos.slice(0, 4).map((src) => (
            <SafeImage key={src} src={src} alt="" className="h-16 w-14 object-cover" />
          ))}
        </div>
      ) : null}
    </li>
  );
}

export { Stars } from "@/components/stars";
