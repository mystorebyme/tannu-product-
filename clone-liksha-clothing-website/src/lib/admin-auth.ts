import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "lk_admin_session";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Liksha@2026";
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const SESSION_SECRET = process.env.ADMIN_SECRET || "liksha-clothing-secret-2026";
export const SESSION_TTL_SECONDS = 60 * 60 * 8;

function sign(value: string, expiry: number): string {
  return createHmac("sha256", SESSION_SECRET).update(`${value}.${expiry}`).digest("hex");
}

export function createSessionToken(user = ADMIN_USER): string {
  const expiry = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  return `${user}.${expiry}.${sign(user, expiry)}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [user, expiryRaw, signature] = parts;
  const expiry = Number(expiryRaw);
  if (!user || !Number.isFinite(expiry)) return false;
  if (expiry < Math.floor(Date.now() / 1000)) return false;
  const expected = sign(user, expiry);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function checkCredentials(username: string, password: string): boolean {
  const a = Buffer.from(username.trim().toLowerCase());
  const b = Buffer.from(ADMIN_USER.toLowerCase());
  const userOk = a.length === b.length && timingSafeEqual(a, b);
  const p1 = Buffer.from(password);
  const p2 = Buffer.from(ADMIN_PASSWORD);
  const passOk = p1.length === p2.length && timingSafeEqual(p1, p2);
  return userOk && passOk;
}

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(ADMIN_COOKIE)?.value);
}

export async function isAdminRequest(): Promise<boolean> {
  return isAuthenticated();
}
