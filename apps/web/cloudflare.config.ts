import { bindings, defineConfig, defineWorker } from "cf/config";

/**
 * Cloudflare Workers config (vinext) — storefront ke liye.
 *
 * Yahan **sirf naam** declare hote hain, koi value nahi. Asli values:
 *   • local dev  → `apps/web/.dev.vars` (gitignored) ya `apps/web/.env`
 *   • preview/prod → `npx vinext-cloudflare deploy` ke baad
 *     `npx wrangler secret put <NAME>` (ya Cloudflare dashboard → Worker →
 *     Settings → Variables and Secrets)
 * Poora list: docs/09-devops/cloudflare-workers.md
 *
 * `bindings.secret()` = sensitive (token/DB/URL), `bindings.text()` = public var.
 */
const SECRETS = [
  // orders/invoices durable rakhne ke liye — Workers par FS read-only hai
  "DATABASE_URL",
  // admin APIs (orders status, tracking, settings, invoices) ka bearer token
  "ADMIN_API_TOKEN",
  // payments page ka return link sign karne ke liye
  "UPI_RETURN_SECRET",
  // OTP (owner ne UI se hataya hai; server verify ke liye secret chahiye)
  "OTP_TOKEN_SECRET",
  // Google Sheets bridge (Settings/Orders sheet = owner ka source of truth)
  "GOOGLE_SHEETS_WEBAPP_URL",
  "GOOGLE_SHEETS_TOKEN",
  "GOOGLE_SHEETS_SETTINGS_CSV_URL",
  "SHEET_SELFTEST_KEY",
  // order/contact email
  "RESEND_API_KEY",
] as const;

export default defineConfig({
  worker: defineWorker({
    name: "liksha-storefront",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-10-26",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      ...Object.fromEntries(SECRETS.map((name) => [name, bindings.secret()])),
      // public var — koi secret nahi, owner-facing domain
      NEXT_PUBLIC_SITE_URL: bindings.text("https://designerclothing.fashion"),
    },
  }),
});
