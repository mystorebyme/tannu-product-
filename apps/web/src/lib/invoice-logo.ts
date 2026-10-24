import path from "node:path";
import { readFile } from "node:fs/promises";

/**
 * Invoice masthead — wahi logo jo header/footer me hai (`public/images/logo-mark.png`).
 * Local file hai, isliye network par depend nahi karta; file na mile to `null`
 * laut-ta hai aur PDF text masthead chhapta hai (purana/duplicate logo kabhi nahi).
 */
export const INVOICE_LOGO_WIDTH = 780;
export const INVOICE_LOGO_HEIGHT = 228;

let cachedLogo: Buffer | null | undefined;

export async function invoiceLogoImage(): Promise<Buffer | null> {
  if (cachedLogo !== undefined) return cachedLogo;
  try {
    const file = path.join(process.cwd(), "public", "images", "logo-mark.png");
    const buffer = await readFile(file);
    cachedLogo = buffer.length > 1000 ? buffer : null;
  } catch {
    cachedLogo = null;
  }
  return cachedLogo;
}
