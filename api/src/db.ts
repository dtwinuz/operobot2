// PostgreSQL access. Every query runs inside tx(): the transaction sets app.org_id, so RLS (sql/001) limits rows
// to one tenant even if a WHERE clause is forgotten. System jobs (webhooks, auth, cleanup) pass SYSTEM explicitly.
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";

export const SYSTEM = Symbol("system");
export type Scope = string | typeof SYSTEM;

export interface Q {
  many<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  one<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T>;
  maybe<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined>;
  exec(sql: string, params?: unknown[]): Promise<number>;
}

let pool: pg.Pool;

pg.types.setTypeParser(20, (v) => Number(v)); // bigint → number (sums, money in so'm fit easily)

export function initDb(url: string): void {
  pool = new pg.Pool({ connectionString: url, max: 10 });
  pool.on("connect", (c) => void c.query("set role ob2_app"));
  pool.on("error", (e) => console.error("[db]", e.message));
}

function wrap(c: pg.PoolClient): Q {
  return {
    many: async (sql, params) => (await c.query(sql, params)).rows,
    one: async (sql, params) => {
      const r = await c.query(sql, params);
      if (!r.rows[0]) throw Object.assign(new Error("topilmadi"), { statusCode: 404 });
      return r.rows[0];
    },
    maybe: async (sql, params) => (await c.query(sql, params)).rows[0],
    exec: async (sql, params) => (await c.query(sql, params)).rowCount ?? 0,
  };
}

export async function tx<T>(scope: Scope, fn: (q: Q) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("select set_config('app.org_id', $1, true), set_config('app.bypass', $2, true)", [scope === SYSTEM ? "" : scope, scope === SYSTEM ? "on" : "off"]);
    const out = await fn(wrap(c));
    await c.query("commit");
    return out;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

export async function ping(): Promise<boolean> {
  try { await pool.query("select 1"); return true; } catch { return false; }
}

/** Applies sql/NNN_*.sql once each, as the connecting (owner) role, before the pool switches to ob2_app. */
export async function migrate(url: string): Promise<void> {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    await c.query("create table if not exists schema_migrations (name text primary key, at timestamptz not null default now())");
    const dir = fileURLToPath(new URL("../sql/", import.meta.url));
    const done = new Set((await c.query("select name from schema_migrations")).rows.map((r) => r.name as string));
    for (const f of (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort()) {
      if (done.has(f)) continue;
      const sql = await readFile(dir + f, "utf8");
      await c.query("begin");
      try {
        await c.query(sql);
        await c.query("insert into schema_migrations(name) values ($1)", [f]);
        await c.query("commit");
        console.log(`[db] migratsiya ${f}`);
      } catch (e) {
        await c.query("rollback");
        throw new Error(`${f}: ${(e as Error).message}`);
      }
    }
  } finally {
    await c.end();
  }
}
