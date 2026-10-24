import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/admin-auth";

export async function requireAdmin(): Promise<void> {
  const authed = await isAuthenticated();
  if (!authed) redirect("/admin/login");
}

export async function adminGuard(): Promise<{ authenticated: boolean }> {
  return { authenticated: await isAuthenticated() };
}
