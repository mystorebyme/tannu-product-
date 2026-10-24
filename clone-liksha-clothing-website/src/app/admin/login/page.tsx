import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/admin-auth";
import { AdminLoginForm } from "@/components/admin/login-form";

export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  const authed = await isAuthenticated();
  if (authed) redirect("/admin");

  return (
    <div>
      <div className="mb-6 text-center">
        <p className="font-display text-[26px] tracking-[.18em] text-[#862222] uppercase">Liksha</p>
        <p className="mt-1 text-[10px] tracking-[.24em] text-[#9c8f82] uppercase">Restricted admin console</p>
      </div>
      <div className="border border-[#e4d9cd] bg-white p-6 shadow-sm">
        <h1 className="text-[11px] font-semibold tracking-[.18em] text-[#862222] uppercase">Sign in</h1>
        <div className="mt-4">
          <AdminLoginForm />
        </div>
        <p className="mt-4 border-t border-[#f1ebe5] pt-3 text-[10.5px] leading-relaxed text-[#9c8f82]">
          This area is hidden from visitors and customers. Access is limited to authorised Liksha staff.
        </p>
      </div>
    </div>
  );
}
