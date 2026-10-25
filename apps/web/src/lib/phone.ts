/**
 * Phone / WhatsApp number helpers — **pure** (koi import nahi).
 *
 * Kyun alag file: `whatsapp.ts` me `siteConfig` aata hai, isliye unit tests usse
 * seedha import nahi kar sakte. Ye helpers wahan se re-export hote hain.
 */

/** wa.me link ke liye country code ke saath number (India = 91). */
export function whatsappNumber(phone: string, fallback = "918005900581"): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return fallback;
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.startsWith("91") && digits.length > 12) return digits.slice(0, 12);
  return digits;
}
