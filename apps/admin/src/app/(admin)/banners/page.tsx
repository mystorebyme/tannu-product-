import Link from "next/link";
import { getSettings } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * Storefront ka top area: announcement bar + home hero banner.
 * Announcement yahin se badla ja sakta hai (turant site par — store settings API).
 * Hero image abhi catalogue/brand asset hai, isliye uski current state yahan dikhti hai.
 */
/** Storefront ka current Diwali/Dewali poster (owner-supplied creative) */
const HERO_IMAGE = "/images/diwali-sale-70-2026.webp";
const HERO_HREF = "/collections/sale";

export default async function BannersPage() {
  const settings = await getSettings();
  const storeUrl = process.env.NEXT_PUBLIC_STORE_URL ?? "http://localhost:3000";

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Banners</h1>
          <p>Announcement bar aur home hero — jo live site par dikh raha hai</p>
        </div>
        <div className="actions">
          <Link className="btn" href="/settings">
            Edit announcement
          </Link>
          <a className="btn" href={storeUrl} target="_blank" rel="noreferrer">
            View site
          </a>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Announcement bar</h2>
          <span className={settings.announcement ? "badge badge-success" : "badge"}>
            {settings.announcement ? "live" : "default copy"}
          </span>
        </div>
        <div className="panel-body">
          <p className="small">{settings.announcement ?? "Storefront apni default announcements dikha raha hai."}</p>
          <p className="small muted">
            Settings page se change kariye — save karte hi website ke header par wahi text dikhne lagta hai.
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Home hero</h2>
        </div>
        <div className="panel-body">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${storeUrl}${HERO_IMAGE}`}
            alt="Current home hero"
            style={{ width: "100%", maxWidth: 560, border: "1px solid #e5dbd0" }}
          />
          <p className="small" style={{ marginTop: 10 }}>
            Hero link: <span className="mono">{HERO_HREF}</span>
          </p>
          <p className="small muted">
            Ye owner ka diya hua festive poster hai (<span className="mono">apps/web/public{HERO_IMAGE}</span>) —
            flat 70% OFF, final price ₹499–₹699. Nayi creative chahiye to image isi path par replace karke
            deploy karo; announcement text Settings (ya Google Sheet) se turant badalta hai.
          </p>
        </div>
      </div>
    </>
  );
}
