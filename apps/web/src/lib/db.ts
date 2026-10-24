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

export function getPool(): Pool {
  if (!DATABASE_URL) throw new Error("DATABASE_URL set nahi hai — Postgres mode available nahi.");
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      // Render/Neon jaise managed Postgres ke liye SSL zaroori hota hai.
      ssl: /localhost|127\.0\.0\.1/.test(DATABASE_URL) ? undefined : { rejectUnauthorized: false },
      max: Number(process.env.DB_POOL_MAX ?? 5),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    // idle client error se process crash na ho
    pool.on("error", (error) => console.error("[db] idle client error", error.message));
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(text, values as never[]);
  return result.rows;
}

/** Ek transaction — sab writes ek saath commit ya rollback. */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
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
}
