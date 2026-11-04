// Outbound call campaigns (docs/05 §Qo'ng'iroqlar). The phone side is the operobot dialer (Asterisk ARI, 1 = operator).
// Demo orgs: calls are simulated here (no phone network). Real orgs: each call goes to DIALER_URL and the result
// comes back on POST /api/hooks/dialer/:secret. Legal lock: real calls only 09:00–18:00 Tashkent (law from 2026-11-01).
import { timingSafeEqual } from "node:crypto";
import { SYSTEM, tx, type Q } from "../db.js";
import { emit } from "../bus.js";
import { config, applyExtracted } from "../flow.js";
import { bump, fits, pushUsage } from "../billing/usage.js";
import { getCall, getCampaign } from "../views.js";

const tashHour = (now = new Date()) => new Date(now.getTime() + 5 * 3600_000).getUTCHours();

export function callWindowOpen(org: { demo: boolean; work_from: number; work_to: number }, now = new Date()): boolean {
  if (org.demo) return true; // simulated calls never reach a phone
  const h = tashHour(now);
  return h >= Math.max(9, org.work_from) && h < Math.min(18, org.work_to);
}

async function pushCall(q: Q, orgId: string, id: string, campaignId: string | null) {
  emit(orgId, "call", await getCall(q, id));
  if (campaignId) emit(orgId, "campaign", await getCampaign(q, campaignId));
}

const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const SUMS = [
  "Mijoz 1 ni bosdi, operator bilan gaplashdi: narx va muddat so'raldi.",
  "Mijoz qiziqdi, ertaga soat 11 da uchrashuvga kelishdi.",
  "Mijoz 1 ni bosdi, bepul konsultatsiyaga yozildi.",
  "Operator bilan gaplashdi, taklifni oilasi bilan maslahatlashmoqchi.",
];

/** One simulation step for a demo campaign call: queued → dialing → outcome. */
async function simulate(orgId: string, callId: string) {
  await tx(orgId, async (q) => {
    await q.exec("update calls set status = 'dialing', started_at = now() where id = $1", [callId]);
    const c = await q.one<{ campaign_id: string }>("select campaign_id from calls where id = $1", [callId]);
    await pushCall(q, orgId, callId, c.campaign_id);
  });
  await new Promise((r) => setTimeout(r, 2500 + Math.random() * 3000));
  const roll = Math.random();
  const status = roll < 0.3 ? "no_answer" : roll < 0.38 ? "busy" : roll < 0.62 ? "declined" : roll < 0.7 ? "answered" : "connected";
  const dur = status === "connected" ? 40 + Math.floor(Math.random() * 160) : status === "declined" || status === "answered" ? 12 + Math.floor(Math.random() * 15) : 0;
  await finish(orgId, callId, status, dur, status === "connected" ? pick(SUMS) : status === "declined" ? "Mijoz 2 ni bosdi: qiziqmaydi." : null);
}

/** Final state for a call (simulation or dialer webhook): usage, lead update, events. */
export async function finish(orgId: string, callId: string, status: string, durationSec: number, summary: string | null) {
  await tx(orgId, async (q) => {
    const c = await q.one<{ campaign_id: string | null; contact_id: string; name: string }>(
      "update calls k set status = $2, duration_sec = $3, summary = $4, ended_at = now() from contacts c where k.id = $1 and c.id = k.contact_id returning k.campaign_id, k.contact_id, c.name",
      [callId, status, durationSec, summary]);
    if (durationSec) await bump(q, orgId, "call_seconds", durationSec);
    if (status === "connected" || status === "declined") {
      const lead = (await q.maybe<{ id: string }>("select id from leads where contact_id = $1 order by created_at desc limit 1", [c.contact_id]))
        ?? await q.one<{ id: string }>("insert into leads(org_id, contact_id, stage_id, title, source) select $1, $2, id, $3, 'call' from stages where org_id = $1 and key = 'yangi' returning id", [orgId, c.contact_id, `${c.name} · qo'ng'iroq`]);
      const meeting = summary?.includes("ertaga soat 11") ? new Date(Date.now() + 86400_000).toISOString().slice(0, 11) + "06:00:00.000Z" : undefined;
      await applyExtracted(q, orgId, lead.id, status === "declined"
        ? { interest: "past", stage: "yutqazildi", summary: summary ?? undefined }
        : { interest: meeting ? "yuqori" : "o'rta", stage: meeting ? "uchrashuv" : "qiziqdi", summary: summary ?? undefined, meeting }, "qo'ng'iroq");
    }
    await pushCall(q, orgId, callId, c.campaign_id);
    if (c.campaign_id) {
      const left = await q.one<{ n: number }>("select count(*)::int n from calls where campaign_id = $1 and status in ('queued', 'dialing')", [c.campaign_id]);
      if (!left.n) { await q.exec("update campaigns set status = 'done' where id = $1", [c.campaign_id]); emit(orgId, "campaign", await getCampaign(q, c.campaign_id)); }
    }
    await pushUsage(q, orgId);
  });
}

async function dial(orgId: string, call: { id: string; phone: string }, secret: string) {
  const cfg = config();
  const r = await fetch(`${cfg.DIALER_URL.replace(/\/$/, "")}/originate`, {
    method: "POST", signal: AbortSignal.timeout(10_000),
    headers: { "content-type": "application/json", authorization: `Bearer ${cfg.DIALER_TOKEN}` },
    body: JSON.stringify({ callId: call.id, phone: call.phone, callback: `${cfg.PUBLIC_URL.replace(/\/$/, "")}/api/hooks/dialer/${secret}` }),
  }).catch((e: Error) => ({ ok: false, status: e.message }) as const);
  await tx(orgId, async (q) => {
    await q.exec("update calls set status = $2, started_at = now() where id = $1", [call.id, r.ok ? "dialing" : "failed"]);
    const k = await q.one<{ campaign_id: string }>("select campaign_id from calls where id = $1", [call.id]);
    await pushCall(q, orgId, call.id, k.campaign_id);
  });
}

const busy = new Set<string>(); // campaign ids with a call in flight (1 line per campaign in v0.1)

/** Every 3 s: for each running campaign whose window is open, start the next queued call. */
export function startCampaignRunner(): void {
  setInterval(() => void tick().catch((e) => console.warn("[kampaniya]", (e as Error).message)), 3000).unref();
}

async function tick() {
  const running = await tx(SYSTEM, (q) => q.many<{ id: string; org_id: string; demo: boolean; work_from: number; work_to: number; plan: string }>(
    "select p.id, p.org_id, o.demo, o.work_from, o.work_to, o.plan from campaigns p join orgs o on o.id = p.org_id where p.status = 'running'"));
  for (const p of running) {
    if (busy.has(p.id) || !callWindowOpen(p)) continue;
    if (!p.demo && !config().DIALER_URL) continue;
    const next = await tx(p.org_id, async (q) => {
      if (!(await fits(q, p.org_id, "callMinutes"))) { await q.exec("update campaigns set status = 'paused' where id = $1", [p.id]); emit(p.org_id, "campaign", await getCampaign(q, p.id)); return null; }
      return q.maybe<{ id: string; phone: string }>(
        `select k.id, c.phone from calls k join contacts c on c.id = k.contact_id
         where k.campaign_id = $1 and k.status = 'queued' order by k.created_at limit 1`, [p.id]);
    });
    if (!next) continue;
    busy.add(p.id);
    const run = p.demo ? simulate(p.org_id, next.id) : dial(p.org_id, next, await dialerSecret(p.org_id));
    void run.catch((e) => console.warn("[qo'ng'iroq]", (e as Error).message)).finally(() => busy.delete(p.id));
  }
}

/** Dialer webhook secret: `<orgId>.<orgs.hook_secret>` (random, stable, never shown in the UI). */
async function dialerSecret(orgId: string): Promise<string> {
  const o = await tx(SYSTEM, (q) => q.one<{ s: string }>("select hook_secret s from orgs where id = $1", [orgId]));
  return `${orgId}.${o.s}`;
}

export async function orgByDialerSecret(secret: string): Promise<string | undefined> {
  const [orgId, s] = secret.split(".");
  if (!/^[0-9a-f-]{36}$/.test(orgId ?? "") || !s) return undefined;
  const o = await tx(SYSTEM, (q) => q.maybe<{ s: string }>("select hook_secret s from orgs where id = $1", [orgId]));
  return o && o.s.length === s.length && timingSafeEqual(Buffer.from(o.s), Buffer.from(s)) ? orgId : undefined;
}
