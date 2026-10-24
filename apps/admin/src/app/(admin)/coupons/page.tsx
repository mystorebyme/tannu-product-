import { COUPONS } from "@liksha/validation";
import { inr } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function CouponsPage() {
  return (
    <>
      <div className="topbar">
        <div>
          <h1>Coupons</h1>
          <p>Active discount codes (shared validation package se)</p>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Discount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(COUPONS).map(([code, percent]) => (
              <tr key={code}>
                <td className="mono">{code}</td>
                <td>
                  {percent}% off · max {inr(200000)}
                </td>
                <td>
                  <span className="badge badge-success">Active</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="notice">
        Coupon rules `packages/validation/index.ts` me hain — ek hi jagah badalne se storefront aur API
        dono update ho jaate hain. Database-driven coupons (limits, expiry, per-user) Phase 2 me aayenge.
      </div>
    </>
  );
}
