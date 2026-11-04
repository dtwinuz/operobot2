// Monthly usage counters and limit checks. Period = calendar month in Tashkent.
import type { Q } from "../db.js";
import { emit } from "../bus.js";
import { plan, type Limits } from "./plans.js";

export const periodStart = (now = new Date()): string => {
  const t = new Date(now.getTime() + 5 * 3600_000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-01`;
};

type Field = "messages" | "ai_replies" | "call_seconds";

export async function bump(q: Q, orgId: string, field: Field, n = 1): Promise<void> {
  await q.exec(
    `insert into usage(org_id, period, ${field}) values ($1, $2, $3)
     on conflict (org_id, period) do update set ${field} = usage.${field} + excluded.${field}`,
    [orgId, periodStart(), n],
  );
}

export async function usageOf(q: Q, orgId: string): Promise<Limits> {
  const u = await q.maybe<{ messages: number; ai_replies: number; call_seconds: number }>(
    "select messages, ai_replies, call_seconds from usage where org_id = $1 and period = $2", [orgId, periodStart()]);
  const c = await q.one<{ ops: number; chans: number }>(
    `select (select count(*)::int from memberships where org_id = $1) ops, (select count(*)::int from channels where org_id = $1) chans`, [orgId]);
  return { operators: c.ops, channels: c.chans, messages: u?.messages ?? 0, aiReplies: u?.ai_replies ?? 0, callMinutes: Math.ceil((u?.call_seconds ?? 0) / 60) };
}

/** true if one more unit of `key` fits the org's plan. */
export async function fits(q: Q, orgId: string, key: keyof Limits): Promise<boolean> {
  const o = await q.one<{ plan: string }>("select plan from orgs where id = $1", [orgId]);
  const lim = plan(o.plan).limits[key];
  if (lim < 0) return true;
  return (await usageOf(q, orgId))[key] < lim;
}

export async function pushUsage(q: Q, orgId: string): Promise<void> {
  emit(orgId, "usage", await usageOf(q, orgId));
}

export const limitError = (what: string) => Object.assign(new Error(`Tarif limiti tugadi: ${what}. Tarifni oshiring.`), { statusCode: 402 });
