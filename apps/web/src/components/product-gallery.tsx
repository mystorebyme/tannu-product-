"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { imageUrl } from "@/lib/format";
import { SafeImage } from "@/components/safe-image";

/**
 * PDP gallery — live store jaisa: thumbnail rail (desktop), cross-fade main image,
 * hover zoom, swipe (mobile), keyboard arrows aur image counter.
 *
 * Sab images product ki apni gallery (`images[]`, live Shopify se) hain — koi duplicate
 * ya doosre product ki image kabhi nahi.
 */
export function ProductGallery({
  images,
  title,
  badge,
}: {
  images: string[];
  title: string;
  badge?: string | null;
}) {
  const gallery = useMemo(() => (images.length ? images : ["/images/placeholder.svg"]), [images]);
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const touchX = useRef<number | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);

  const go = useCallback(
    (next: number) => setIndex((current) => (next + gallery.length) % gallery.length),
    [gallery.length],
  );

  // aage-pichhli image preload — arrow dabate hi blank frame na dikhe
  useEffect(() => {
    for (const offset of [1, -1, 2]) {
      const src = gallery[(index + offset + gallery.length) % gallery.length];
      if (!src) continue;
      const img = new Image();
      img.src = imageUrl(src, 900);
    }
  }, [index, gallery]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      // input/modal me type karte waqt arrow se gallery na badle
      const tag = (event.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (event.key === "ArrowRight") go(index + 1);
      if (event.key === "ArrowLeft") go(index - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  function onMove(event: React.MouseEvent<HTMLDivElement>) {
    const node = frameRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setOrigin(`${x}% ${y}%`);
  }

  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row">
      {gallery.length > 1 ? (
        <div className="no-scrollbar flex gap-2 overflow-x-auto sm:max-h-[560px] sm:w-[78px] sm:shrink-0 sm:flex-col sm:overflow-y-auto">
          {gallery.map((image, imageIndex) => (
            <button
              key={`${image}-${imageIndex}`}
              type="button"
              onClick={() => setIndex(imageIndex)}
              aria-label={`View image ${imageIndex + 1} of ${gallery.length}`}
              aria-current={index === imageIndex}
              className={`relative h-20 w-16 shrink-0 overflow-hidden border bg-[#f6f1ec] transition sm:h-[96px] sm:w-full ${
                index === imageIndex
                  ? "border-[#862222] opacity-100"
                  : "border-transparent opacity-75 hover:border-[#d9c6b4] hover:opacity-100"
              }`}
            >
              <SafeImage src={imageUrl(image, 200)} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}

      <div className="relative flex-1">
        <div
          ref={frameRef}
          className="relative aspect-[3/4] w-full touch-pan-y overflow-hidden bg-[#f6f1ec]"
          onMouseEnter={() => setZoom(true)}
          onMouseLeave={() => {
            setZoom(false);
            setOrigin("50% 50%");
          }}
          onMouseMove={onMove}
          onTouchStart={(event) => {
            touchX.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            const start = touchX.current;
            const end = event.changedTouches[0]?.clientX ?? null;
            touchX.current = null;
            if (start === null || end === null) return;
            const delta = end - start;
            if (Math.abs(delta) < 40) return;
            go(index + (delta < 0 ? 1 : -1));
          }}
        >
          {gallery.map((image, imageIndex) => (
            <div
              key={`${image}-slide-${imageIndex}`}
              className={`gallery-slide absolute inset-0 ${
                imageIndex === index ? "z-10 opacity-100" : "pointer-events-none opacity-0"
              }`}
              aria-hidden={imageIndex !== index}
            >
              <SafeImage
                src={imageUrl(image, imageIndex === index ? 1200 : 600)}
                alt={`${title} — image ${imageIndex + 1}`}
                loading={imageIndex === 0 ? "eager" : "lazy"}
                fetchPriority={imageIndex === 0 ? "high" : "auto"}
                className="h-full w-full object-cover"
              />
            </div>
          ))}

          {/* hover zoom layer (sirf pointer devices par dikhta hai) */}
          <div
            className="pointer-events-none absolute inset-0 hidden bg-no-repeat transition-transform duration-300 ease-out sm:block"
            style={{
              backgroundImage: zoom ? `url("${imageUrl(gallery[index], 1400)}")` : "none",
              backgroundSize: "190%",
              backgroundPosition: origin,
              opacity: zoom ? 1 : 0,
            }}
          />

          {badge ? (
            <span className="absolute left-3 top-3 z-20 bg-[#862222] px-2 py-1 text-[10px] font-semibold tracking-[.1em] text-white uppercase">
              {badge}
            </span>
          ) : null}

          {gallery.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => go(index - 1)}
                aria-label="Previous image"
                className="absolute left-2 top-1/2 z-20 -translate-y-1/2 bg-white/85 p-2 text-[#3f3830] opacity-0 shadow-sm transition hover:bg-white focus-visible:opacity-100 group-hover:opacity-100 sm:opacity-0 sm:hover:opacity-100 [@media(hover:none)]:opacity-100"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M15 5l-7 7 7 7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => go(index + 1)}
                aria-label="Next image"
                className="absolute right-2 top-1/2 z-20 -translate-y-1/2 bg-white/85 p-2 text-[#3f3830] opacity-0 shadow-sm transition hover:bg-white focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <span className="absolute bottom-3 right-3 z-20 bg-black/45 px-2 py-1 text-[10.5px] tracking-[.1em] text-white">
                {index + 1} / {gallery.length}
              </span>
            </>
          ) : null}
        </div>

        {gallery.length > 1 ? (
          <div className="mt-2 flex justify-center gap-1.5 sm:hidden">
            {gallery.map((image, imageIndex) => (
              <button
                key={`${image}-dot`}
                type="button"
                onClick={() => setIndex(imageIndex)}
                aria-label={`Image ${imageIndex + 1}`}
                className={`h-1.5 w-1.5 rounded-full transition ${
                  index === imageIndex ? "bg-[#862222]" : "bg-[#d9c6b4]"
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
