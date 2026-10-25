/**
 * Phone / WhatsApp helpers — **pure** (koi import nahi, koi env nahi).
 *
 * Kyun alag file: contact page ka "WhatsApp us" button `wa.me/8005900581` bana
 * raha tha — WhatsApp ko **country code** chahiye hota hai, warna "invalid
 * number" aata hai. Sheet/admin me number kabhi `8005900581`, kabhi
 * `+91 80059 00581`, kabhi `918005900581` ho sakta hai — ye helper teeno ko ek
 * hi sahi link bana deta hai.
 */

/** `wa.me` ke liye number — hamesha country code ke saath (India = 91). */
export function whatsappNumber(raw?: string | null, fallback = "918005900581"): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return fallback;
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  // kabhi `+91 91 80059…` jaisa duplicate aa jaye to pehle 12 digits hi rakho
  if (digits.startsWith("91")) return digits.slice(0, 12);
  return digits;
}

/** Sirf 10 digit ka local number (display ke liye). */
export function localPhone(raw?: string | null): string {
  const digits = whatsappNumber(raw);
  return digits.slice(-10);
}

/** Poora wa.me link (optional pre-filled message ke saath). */
export function whatsappHref(raw?: string | null, message?: string): string {
  const base = `https://wa.me/${whatsappNumber(raw)}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
