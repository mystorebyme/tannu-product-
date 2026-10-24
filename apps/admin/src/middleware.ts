import { NextResponse, type NextRequest } from "next/server";

/**
 * Session ko har request par "sliding" rakhta hai.
 *
 * Pehle session 8 ghante ki thi aur redeploy/secret change par turant logout ho jaata tha —
 * admin ko baar-baar login karna padta tha. Ab:
 *  • cookie 30 din ki (httpOnly, sameSite=lax),
 *  • jab session me 20 din se kam bachein to middleware naya token bhej deta hai (bina login),
 *  • sirf GET requests par — server actions ke response ko chhedta nahi.
 *
 * HMAC yahan Web Crypto se hota hai (middleware runtime), algorithm wahi hai jo
 * `lib/auth.ts` me `node:crypto` se banta hai.
 */

const COOKIE = "liksha_admin";
const REFRESH_AFTER_MS = 20 * 24 * 60 * 60 * 1000;
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const encoder = new TextEncoder();

function base64url(bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Unicode-safe base64url encode (Buffer edge runtime me nahi hota). */
function encodePayload(value: unknown): string {
  const bytes = encoder.encode(JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodePayload(payload: string): string {
  const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new TextDecoder().decode(bytes);
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64url(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
}

export async function middleware(request: NextRequest) {
  if (request.method !== "GET") return NextResponse.next();

  const token = request.cookies.get(COOKIE)?.value;
  if (!token) return NextResponse.next();

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return NextResponse.next();

  const secret =
    process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_API_TOKEN || "dev-only-secret-change-me";

  const expected = await sign(payload, secret);
  // Edge runtime me timingSafeEqual nahi hai; length + value compare.
  if (expected.length !== signature.length || expected !== signature) return NextResponse.next();

  let session: { email?: string; role?: "owner" | "staff"; exp?: number };
  try {
    session = JSON.parse(decodePayload(payload));
  } catch {
    return NextResponse.next();
  }

  const remaining = (session.exp ?? 0) - Date.now();
  if (!session.email || remaining <= 0 || remaining > REFRESH_AFTER_MS) return NextResponse.next();

  const nextPayload = encodePayload({
    email: session.email,
    role: session.role ?? "owner",
    exp: Date.now() + MAX_AGE_SECONDS * 1000,
  });
  const nextToken = `${nextPayload}.${await sign(nextPayload, secret)}`;

  const response = NextResponse.next();
  response.cookies.set(COOKIE, nextToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|css|js)$).*)"],
};
