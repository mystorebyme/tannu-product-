import "server-only";

import { Pool, type PoolClient, type QueryResultRow } from "pg";

/**
 * Postgres connection.
 *
 * `DATABASE_URL` set hai to orders/invoices Postgres me rehte hain (Render par
 * disk permanent nahi hota, isliye yeh production mode hai). Set nahi hai to
 * local JSON store chalta hai — dev aur tests bina DB ke chal jaate hain.
 */

const DATABASE_URL = process.env.DATABASE_URL ?? "";

export function databaseUrl(): string {
  return DATABASE_URL;
}

export function dbEnabled(): boolean {
  return DATABASE_URL.length > 0;
}

let pool: Pool | null = null;

/**
 * Serverless (Vercel) par har invocation apna pool banata hai. Managed Postgres
 * ka pooler (Supabase session mode) sirf ~15 clients deta hai — 5-per-instance
 * pool rakhne par `EMAXCONNSESSION max clients reached` aata hai aur order page
 * / UTR submit 500 dete hain. Isliye serverless par pool chhota + jaldi idle.
 */
const IS_SERVERLESS = Boolean(process.env.VERCEL);
const POOL_MAX = Number(process.env.DB_POOL_MAX ?? (IS_SERVERLESS ? 1 : 5));

export function getPool(): Pool {
  if (!DATABASE_URL) throw new Error("DATABASE_URL set nahi hai — Postgres mode available nahi.");
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      // Render/Neon jaise managed Postgres ke liye SSL zaroori hota hai.
      ssl: /localhost|127\.0\.0\.1/.test(DATABASE_URL) ? undefined : { rejectUnauthorized: false },
      max: POOL_MAX,
      idleTimeoutMillis: IS_SERVERLESS ? 5_000 : 30_000,
      allowExitOnIdle: IS_SERVERLESS,
      connectionTimeoutMillis: 10_000,
    });
    // idle client error se process crash na ho
    pool.on("error", (error) => console.error("[db] idle client error", error.message));
  }
  return pool;
}

/** Pooler ke transient errors — ek chhota retry user ko 500 se bacha leta hai. */
const TRANSIENT_DB_ERROR =
  /EMAXCONNSESSION|too many clients|ECONNRESET|ECONNREFUSED|ETIMEDOUT|timeout exceeded when trying to connect|Connection terminated/i;

async function withDbRetry<T>(run: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!TRANSIENT_DB_ERROR.test(message) || attempt === attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
    }
  }
  throw lastError;
}

/**
 * Schema bootstrap — serverless par (Vercel) koi `db:migrate` step nahi chalta,
 * isliye pehli DB query se pehle schema apply ho jaata hai:
 *   • advisory lock → do cold starts ek saath migrate na karein
 *   • `orders` table maujood hai to schema skip, sirf nayi migrations chalti hain
 *   • har migration `schema_migrations` me record hoti hai (idempotent)
 *
 * Local/test (JSON store) par DATABASE_URL hi nahi hota → kuch nahi hota.
 */
let schemaPromise: Promise<void> | null = null;

async function applySchema(): Promise<void> {
  const { SCHEMA_SQL, MIGRATIONS } = await import("./db-schema");
  const client = await getPool().connect();
  try {
    await client.query("select pg_advisory_lock(727272727)");
    const { rows } = await client.query<{ has_orders: boolean }>(
      "select to_regclass('public.orders') is not null as has_orders",
    );
    if (!rows[0]?.has_orders) {
      console.info("[db] schema.sql apply ho raha hai (pehli baar)…");
      await client.query("begin");
      try {
        await client.query(SCHEMA_SQL);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback").catch(() => undefined);
        throw error;
      }
    }
    await client.query(
      "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    const applied = await client.query<{ name: string }>("select name from schema_migrations");
    const done = new Set(applied.rows.map((row) => row.name));
    for (const [name, sql] of Object.entries(MIGRATIONS)) {
      if (done.has(name)) continue;
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into schema_migrations (name) values ($1) on conflict do nothing", [name]);
        await client.query("commit");
        console.info(`[db] migration applied: ${name}`);
      } catch (error) {
        await client.query("rollback").catch(() => undefined);
        throw error;
      }
    }
  } finally {
    await client.query("select pg_advisory_unlock(727272727)").catch(() => undefined);
    client.release();
  }
}

export async function ensureSchema(): Promise<void> {
  if (!DATABASE_URL) return;
  if (!schemaPromise) {
    schemaPromise = applySchema().catch((error) => {
      // agla request dobara try kare (thodi der ka DB outage permanent na ban jaye)
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  await ensureSchema();
  const result = await withDbRetry(() => getPool().query<T>(text, values as never[]));
  return result.rows;
}

/** Ek transaction — sab writes ek saath commit ya rollback. */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema();
  // connection milne me pooler "too many clients" deta hai — poora transaction
  // dobara chalao (rollback ho chuka hota hai, isliye safe).
  return withDbRetry(async () => {
    const client = await getPool().connect();
    try {
      await client.query("begin");
      const result = await fn(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  });
}
