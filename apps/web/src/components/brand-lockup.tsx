import { logoMark } from "@/config/site";

/**
 * Brand lockup — owner ka final logo (gold crown + gown) + "DESIGNER CLOTHING" wordmark.
 *
 * Mark image (`/images/logo-mark.png`) ka background black hai, isliye usko
 * chhote black plate me dikhate hain — gold mark ka contrast bana rehta hai aur
 * header/footer dono par same dikhta hai. Wordmark HTML text hai (crisp on retina,
 * mobile par bhi padha jaata hai). Sab jagah ek hi component use hota hai.
 */
export function BrandLockup({
  tone = "dark",
  compact = false,
  className = "",
}: {
  /** `dark` = light background (header), `light` = maroon/dark footer */
  tone?: "dark" | "light";
  compact?: boolean;
  className?: string;
}) {
  const gold = tone === "light" ? "#f0c862" : "#b8860b";
  return (
    <span className={`flex items-center gap-2 sm:gap-2.5 ${className}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black ring-1 ring-[#b8860b]/60 sm:h-11 sm:w-11">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoMark}
          alt="Designer Clothing logo"
          width={44}
          height={44}
          className="h-full w-full scale-[1.35] object-contain"
        />
      </span>
      <span className="flex flex-col leading-none">
        <span
          className="font-display text-[17px] font-medium tracking-[.14em] sm:text-[19px] lg:text-[21px]"
          style={{ color: gold }}
        >
          DESIGNER
        </span>
        <span
          className={`mt-[3px] text-[8.5px] tracking-[.42em] sm:text-[9.5px] ${
            compact ? "" : "sm:tracking-[.46em]"
          }`}
          style={{ color: tone === "light" ? "#f7e7c6" : "#6b6259" }}
        >
          CLOTHING
        </span>
      </span>
    </span>
  );
}
