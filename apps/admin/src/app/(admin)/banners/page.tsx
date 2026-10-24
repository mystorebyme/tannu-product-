export default function BannersPage() {
  return (
    <>
      <div className="topbar">
        <div>
          <h1>Banners</h1>
          <p>Homepage hero aur section banners</p>
        </div>
      </div>
      <div className="panel" style={{ marginTop: 0 }}>
        <div className="empty">
          Hero banner abhi code se control hota hai (`apps/web/src/app/page.tsx`). CMS-driven banners
          Phase 2 me aayenge taaki marketing team bina deploy badal sake.
        </div>
      </div>
    </>
  );
}
