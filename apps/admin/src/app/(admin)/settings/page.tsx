import { getSettings } from "@/lib/data";
import { getSession } from "@/lib/session";
import { saveSettingsAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();
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
              <label htmlFor="upiId">UPI ID (payments yahan aate hain)</label>
              <input id="upiId" name="upiId" defaultValue={settings.upiId} placeholder="name@bank" />
            </div>
            <div className="field">
              <label htmlFor="upiName">UPI payee name</label>
              <input id="upiName" name="upiName" defaultValue={settings.upiName} />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="whatsapp">WhatsApp number</label>
              <input id="whatsapp" name="whatsapp" defaultValue={settings.whatsapp} />
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
            Settings database me save hoti hain aur audit log me record hoti hain. Agar Google Sheet
            configured hai (<code>GOOGLE_SHEETS_WEBAPP_URL</code>) to <strong>Settings sheet ki value</strong>{" "}
            jeetti hai — owner wahan se phone, email, UPI ID aur announcement bina redeploy badal sakta hai.
            Detail: <code>docs/09-devops/google-sheets.md</code>.
          </p>
        </div>
      </form>
    </>
  );
}
