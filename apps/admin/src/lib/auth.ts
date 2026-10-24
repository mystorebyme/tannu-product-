import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET = process.env.ADMIN_SESSION_SECRET ?? "dev-only-secret-change-me";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "liksha2026";
const EMAIL = process.env.ADMIN_EMAIL ?? "admin@likshaclothing.com";
export const SESSION_COOKIE = "liksha_admin";
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

export type Session = { email: string; role: "owner" | "staff"; exp: number };

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("base64url");
}

export function createSessionToken(email: string, role: Session["role"] = "owner"): string {
  const payload = Buffer.from(
    JSON.stringify({ email, role, exp: Date.now() + MAX_AGE_SECONDS * 1000 }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (expected.length !== signature.length) return null;
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session;
    if (session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

/** Timing-safe password check (plain compare timing leak deta hai) */
export function checkCredentials(email: string, password: string): boolean {
  const emailOk = email.trim().toLowerCase() === EMAIL.toLowerCase();
  const a = Buffer.from(password);
  const b = Buffer.from(PASSWORD);
  const passwordOk = a.length === b.length && timingSafeEqual(a, b);
  return emailOk && passwordOk;
}

export const SESSION_MAX_AGE = MAX_AGE_SECONDS;
export const ADMIN_EMAIL_HINT = EMAIL;
