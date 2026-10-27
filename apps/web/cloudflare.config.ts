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
  // R40: orders sirf Google Sheet me save hote hain (owner: "Supabase nahi —
  // only sheet") — DATABASE_URL ab Worker ko chahiye hi nahi, isliye list se gaya.
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

/**
 * Worker ka naam — default `liksha-storefront`, par **`WORKER_NAME` env se override**.
 *
 * Kyun: owner ka Cloudflare worker pehle se **`designer`** naam se bana hua hai (Git
 * integration usi par hai, domain/routes usi par lage hain). Naam override na ho to
 * `cf deploy` ek **naya** worker bana deta aur `designer` purana/stale reh jaata.
 * Cloudflare dashboard → Worker → Settings → Build → **Build variables** me
 * `WORKER_NAME=designer` daal dein (ya local par `WORKER_NAME=designer npm run deploy:worker`).
 */
const WORKER_NAME = process.env.WORKER_NAME?.trim() || "liksha-storefront";

export default defineConfig({
  worker: defineWorker({
    name: WORKER_NAME,
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
      /**
       * Sheet → site **real-time** knobs (R35).
       *
       * Workers par `process.env` sirf wahi padh sakta hai jo yahan declare ho,
       * isliye ye values config me hain. UPI ID khud **sheet se** aata hai
       * (`GOOGLE_SHEETS_WEBAPP_URL`); `STORE_UPI_ID` sirf emergency fallback hai.
       *
       *   SHEET_READ_TIMEOUT_MS  Apps Script `doGet` cold start par 1–4s leta hai;
       *                          900ms par read hamesha timeout hota tha aur site
       *                          default UPI dikha deti thi.
       *   SHEET_SETTINGS_TTL_MS  owner ka sheet edit itni der me site par (payment
       *                          page `?fresh=1` se turant padhta hai).
       */
      SHEET_READ_TIMEOUT_MS: bindings.text("4000"),
      SHEET_SETTINGS_TTL_MS: bindings.text("2000"),
      SHEET_TRACKING_TTL_MS: bindings.text("2000"),
      /**
       * R38: UPI ka **ek hi source sheet hai** (`upi_id`). `STORE_UPI_ID` sirf
       * emergency fallback hai — par fallback declare hi na ho to Workers par
       * kabhi kaam hi nahi karta (Vercel/Next se parity toot ti hai). Workers par
       * text bindings `.dev.vars` se override nahi hote, isliye value **build ke
       * waqt** shell env se bake hoti hai (local preview/tests ke liye); production
       * Workers build me env nahi hota → default khaali → sheet hi sab kuch.
       */
      STORE_UPI_ID: bindings.text(process.env.STORE_UPI_ID?.trim() ?? ""),
      /**
       * R40: sheet ka id **sirf env me** rehta hai (owner rule: sheet ki koi cheez
       * code me hardcoded nahi). Value build ke waqt shell env se bake hoti hai —
       * `STORE_UPI_ID` wala hi pattern. Kaam: script props khaali mile
       * (`sheet_not_configured`) to site khud `sheet_set?id=…` chala kar heal karti
       * hai. Khaali → heal band (honest), Vercel par wahi env already set hai.
       */
      SHEET_EXPECTED_ID: bindings.text(process.env.SHEET_EXPECTED_ID?.trim() ?? ""),
    },
  }),
});
