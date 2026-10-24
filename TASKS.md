# Tasks

Priority: **P0** = launch blocker · **P1** = first week after launch · **P2** = later.

## P0 — before going live

- [ ] **Live Razorpay keys** in Vercel + Render (`RAZORPAY_KEY_ID`, `_KEY_SECRET`, `_WEBHOOK_SECRET`)
      and register `https://api.likshaclothing.com/api/v1/webhooks/razorpay`.
- [ ] **Full catalogue media** — run `npm run catalog:sync-live` on a machine with internet, then
      `npm run catalog:verify && npm run build:web`. Needs: complete image galleries and the store's own
      `body_html` descriptions per product.
- [ ] **Price parity spot-check** — 10 random products vs likshaclothing.com (title, price, MRP, sizes).
- [ ] **Production secrets** — rotate `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `ADMIN_API_TOKEN`
      (dev defaults exist in the repo on purpose; prod boot check should fail on them).
- [ ] **Domain + DNS** — apex → web, `admin.` → admin app, `api.` → Render (`docs/10-deployment/dns.md`).
- [ ] **Uptime monitor** on `/api/health` + `/api/v1/health` (`infra/monitoring/uptime.sh` or a hosted one).
- [ ] **Backup cron** — `database/scripts/backup.sh` daily + weekly off-server copy.
- [ ] **Mobile pass on a real phone** — home → PLP → PDP → cart → COD order.
- [ ] **Policies reviewed** by the owner (returns window, refund timeline, grievance officer).

## P1 — week one

- [ ] Diwali/November 2026 hero + occasion strip copy.
- [ ] WhatsApp order-confirmation template (COD confirmation reduces fake orders).
- [ ] Replace hotlinked CDN images with mirrored storage (R2/S3) + `srcset` sizes.
- [ ] Shiprocket AWB automation (currently manual AWB in the order note).
- [ ] Invoice PDF (GSTIN, HSN, CGST/SGST) attached to the order email.
- [ ] Coupon management in admin (currently codes live in `@liksha/validation`).

## P2 — Phase 2 (needs Postgres)

- [ ] Prisma migration `json → postgres` (`docs/04-data/migrations.md` cutover plan).
- [ ] Customer accounts + order history (`users`, session, OTP login).
- [ ] Size-wise stock + reservation (15 min TTL) and low-stock alerts.
- [ ] Reviews with photo upload + moderation queue.
- [ ] Wishlist + shareable wishlists.
- [ ] Search upgrade (Meilisearch) when catalogue > 2,000 SKUs.
- [ ] Analytics dashboard (funnel: PDP → bag → checkout → paid).

## P3 — nice to have

- [ ] Hindi/Hinglish locale toggle.
- [ ] Pincode-wise delivery estimate + COD availability check.
- [ ] Abandoned-cart WhatsApp nudge.
- [ ] Referral codes and loyalty points.
- [ ] Blog/editorial CMS (`docs/00-overview/reference-sites-analysis.md` has the sitemap for it).

## Housekeeping

- [ ] Monthly `npm audit` + dependency bumps (Dependabot PRs).
- [ ] Monthly restore rehearsal from backup.
- [ ] Delete `clone-liksha-clothing-website/` once `catalog:sync-live` has run end-to-end
      (it is only the bootstrap data source for `build-catalog.mjs`).
