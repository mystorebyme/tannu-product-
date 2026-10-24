/**
 * Invoice masthead — live store ka hi logo (same asset jo header/footer me hai).
 * Fetch fail ho to `null` laut-ta hai: tab PDF text masthead chhapta hai,
 * kyunki purana/duplicate logo chhapna galat hai.
 */
export const INVOICE_LOGO_WIDTH = 780;
export const INVOICE_LOGO_HEIGHT = 228;

/** live store ka asli logo (same to same) */
export const LIVE_LOGO_URL =
  "https://www.likshaclothing.com/cdn/shop/files/Pink_Abstract_Watercolor_Creative_Logo_3_copy_2.png?v=1734092749&width=600";

let cachedLiveLogo: Buffer | null | undefined;

/**
 * Invoice masthead ke liye live store ka hi logo.
 * Ek baar fetch hota hai aur process me cache rehta hai; network fail ho to
 * embedded copy par chala jaata hai — invoice kabhi bina logo ka nahi.
 */
export async function invoiceLogoImage(): Promise<Buffer | null> {
  if (cachedLiveLogo !== undefined) return cachedLiveLogo;
  try {
    const response = await fetch(LIVE_LOGO_URL, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error(String(response.status));
    const buffer = Buffer.from(await response.arrayBuffer());
    cachedLiveLogo = buffer.length > 1000 ? buffer : null;
  } catch {
    cachedLiveLogo = null;
  }
  return cachedLiveLogo;
}
