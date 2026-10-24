import test from "node:test";
import assert from "node:assert/strict";
import {
  SESSION_COOKIE,
  checkCredentials,
  createSessionToken,
  verifySessionToken,
} from "../../apps/admin/src/lib/auth.ts";

test("cookie name is stable (middleware depends on it)", () => {
  assert.equal(SESSION_COOKIE, "liksha_admin");
});

test("session token round-trips", () => {
  const token = createSessionToken("admin@likshaclothing.com");
  const session = verifySessionToken(token);
  assert.equal(session?.email, "admin@likshaclothing.com");
  assert.equal(session?.role, "owner");
  assert.ok(session!.exp > Date.now());
});

test("tampered token is rejected", () => {
  const token = createSessionToken("admin@likshaclothing.com");
  const [payload, signature] = token.split(".");
  const forgedPayload = Buffer.from(
    JSON.stringify({ email: "attacker@example.com", role: "owner", exp: Date.now() + 60_000 }),
  ).toString("base64url");
  assert.equal(verifySessionToken(`${forgedPayload}.${signature}`), null);
  assert.equal(verifySessionToken(payload), null);
  assert.equal(verifySessionToken("garbage"), null);
  assert.equal(verifySessionToken(undefined), null);
});

test("expired session is rejected", () => {
  const token = createSessionToken("admin@likshaclothing.com");
  const [, signature] = token.split(".");
  const expired = Buffer.from(
    JSON.stringify({ email: "admin@likshaclothing.com", role: "owner", exp: Date.now() - 1 }),
  ).toString("base64url");
  assert.equal(verifySessionToken(`${expired}.${signature}`), null);
});

test("credentials check is exact and case-insensitive on email", () => {
  assert.equal(checkCredentials("admin@likshaclothing.com", "liksha2026"), true);
  assert.equal(checkCredentials("ADMIN@likshaclothing.com", "liksha2026"), true);
  assert.equal(checkCredentials("admin@likshaclothing.com", "wrong"), false);
  assert.equal(checkCredentials("someone@else.com", "liksha2026"), false);
});
