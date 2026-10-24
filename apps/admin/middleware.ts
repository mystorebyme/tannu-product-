import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware: cookie na ho to login par bhejo.
 * (Signature verification server components me hoti hai — node:crypto yahan available nahi.)
 */
export function middleware(request: NextRequest) {
  const isLogin = request.nextUrl.pathname.startsWith("/login");
  const hasSession = Boolean(request.cookies.get("liksha_admin")?.value);

  if (!hasSession && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  if (hasSession && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/admin/login).*)"],
};
