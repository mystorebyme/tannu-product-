import { getSettings } from "@/lib/data";
import { getSession } from "@/lib/session";
import { saveSettingsAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = getSettings();
  const session = await getSession();

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Settings</h1>
          <p>Shipping, payment aur support details (prepaid only — COD nahi)</p>
        </div>
      </div>

      <form action={saveSettingsAction} className="panel">
        <div className="panel-head">
          <h2>Store settings</h2>
          <button className="btn btn-primary btn-sm" type="submit">
            Save changes
          </button>
        </div>
        <div className="panel-body">
          <input type="hidden" name="actor" value={session?.email ?? "admin"} />
          <div className="field">
            <label htmlFor="announcement">Announcement bar</label>
            <input id="announcement" name="announcement" defaultValue={settings.announcement} />
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="freeShipping">Free shipping</label>
              <label className="small" style={{ textTransform: "none", letterSpacing: 0 }}>
                <input
                  id="freeShipping"
                  name="freeShipping"
                  type="checkbox"
                  defaultChecked={settings.freeShipping}
                  style={{ width: "auto", marginRight: 8 }}
                />
                Sabhi prepaid orders par free
              </label>
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="upiId">UPI ID (manual payments)</label>
              <input id="upiId" name="upiId" defaultValue={settings.upiId} />
            </div>
            <div className="field">
              <label htmlFor="gstin">GSTIN</label>
              <input id="gstin" name="gstin" defaultValue={settings.gstin} />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="supportPhone">Support phone</label>
              <input id="supportPhone" name="supportPhone" defaultValue={settings.supportPhone} />
            </div>
            <div className="field">
              <label htmlFor="supportEmail">Support email</label>
              <input id="supportEmail" name="supportEmail" defaultValue={settings.supportEmail} />
            </div>
          </div>
          <p className="small muted" style={{ marginBottom: 0 }}>
            Settings `.data/settings.json` me save hoti hain (production me `settings` table). Koi bhi change
            audit log me record hota hai.
          </p>
        </div>
      </form>
    </>
  );
}
