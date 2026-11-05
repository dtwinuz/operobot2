// Outbound call campaigns (docs/05 §Qo'ng'iroqlar). The phone side is the operobot dialer (Asterisk ARI, 1 = operator).
// Demo orgs: calls are simulated here (no phone network). Real orgs: each call goes to DIALER_URL and the result
// comes back on POST /api/hooks/dialer/:secret. Legal lock: real calls only 09:00–18:00 Tashkent (law from 2026-11-01).
import { timingSafeEqual } from "node:crypto";
import { SYSTEM, tx, type Q } from "../db.js";
import { emit } from "../bus.js";
import { config, applyExtracted } from "../flow.js";
import { bump, fits, pushUsage } from "../billing/usage.js";
import { getCall, getCampaign } from "../views.js";

// Same fixed days off as the operobot dialer (dialer/src/guard.ts). Hayit dates change yearly: HOLIDAYS in .env.
const FIXED_HOLIDAYS = new Set(["01-01", "03-08", "03-21", "05-09", "09-01", "10-01", "12-08"]);
const BLOCKED_NOTE = "Qora ro'yxatda: qo'ng'iroq qilinmadi";
const STALE_MINUTES = { real: 30, demo: 5 }; // real: dialer's MAX_TALK_SEC is 30 min; demo: only a restart strands a call

export function callWindowOpen(org: { demo: boolean; work_from: number; work_to: number }, now = new Date(), holidays = config()?.HOLIDAYS ?? ""): boolean {
  if (org.demo) return true; // simulated calls never reach a phone
  const tash = new Date(now.getTime() + 5 * 3600_000);
  const day = tash.toISOString().slice(0, 10);
  if (tash.getUTCDay() === 0 || FIXED_HOLIDAYS.has(day.slice(5)) || holidays.includes(day)) return false;
  const h = tash.getUTCHours();
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

/** One simulation step for a demo campaign call the runner has already claimed: dialing → outcome. */
async function simulate(orgId: string, callId: string) {
  await new Promise((r) => setTimeout(r, 2500 + Math.random() * 3000));
  const roll = Math.random();
  const status = roll < 0.3 ? "no_answer" : roll < 0.38 ? "busy" : roll < 0.62 ? "declined" : roll < 0.7 ? "answered" : "connected";
  const dur = status === "connected" ? 40 + Math.floor(Math.random() * 160) : status === "declined" || status === "answered" ? 12 + Math.floor(Math.random() * 15) : 0;
  await finish(orgId, callId, status, dur, status === "connected" ? pick(SUMS) : status === "declined" ? "Mijoz 2 ni bosdi: qiziqmaydi." : null);
}

/** Closes the campaign when nothing is left to dial. */
async function settle(q: Q, orgId: string, campaignId: string) {
  const left = await q.one<{ n: number }>("select count(*)::int n from calls where campaign_id = $1 and status in ('queued', 'dialing')", [campaignId]);
  if (left.n) return;
  if (await q.exec("update campaigns set status = 'done' where id = $1 and status <> 'done'", [campaignId])) emit(orgId, "campaign", await getCampaign(q, campaignId));
}

/**
 * Final state for a call (simulation or dialer webhook): usage, lead update, events. Only an open call changes, so a
 * repeated webhook cannot bill twice. 'queued' stays allowed: the result can beat our own bookkeeping after a retry.
 */
export async function finish(orgId: string, callId: string, status: string, durationSec: number, summary: string | null) {
  await tx(orgId, async (q) => {
    const c = await q.maybe<{ campaign_id: string | null; contact_id: string; name: string }>(
      `update calls k set status = $2, duration_sec = $3, summary = $4, ended_at = now(), started_at = coalesce(k.started_at, now()) from contacts c
       where k.id = $1 and c.id = k.contact_id and k.status in ('queued', 'dialing') returning k.campaign_id, k.contact_id, c.name`,
      [callId, status, durationSec, summary]);
    if (!c) return;
    if (durationSec) await bump(q, orgId, "call_seconds", durationSec);
    if (status === "declined") await q.exec("update contacts set do_not_call_at = coalesce(do_not_call_at, now()), do_not_call_reason = coalesce(do_not_call_reason, '2_bosdi') where id = $1", [c.contact_id]);
    if (status === "connected" || status === "declined" || status === "operator_busy") {
      const lead = (await q.maybe<{ id: string }>("select id from leads where contact_id = $1 order by created_at desc limit 1", [c.contact_id]))
        ?? await q.one<{ id: string }>("insert into leads(org_id, contact_id, stage_id, title, source) select $1, $2, id, $3, 'call' from stages where org_id = $1 and key = 'yangi' returning id", [orgId, c.contact_id, `${c.name} · qo'ng'iroq`]);
      const meeting = summary?.includes("ertaga soat 11") ? new Date(Date.now() + 86400_000).toISOString().slice(0, 11) + "06:00:00.000Z" : undefined;
      await applyExtracted(q, orgId, lead.id, status === "declined"
        ? { interest: "past", stage: "yutqazildi", summary: summary ?? undefined }
        : status === "operator_busy" // pressed 1 but no operator was free: the hottest lead, must not get lost
        ? { interest: "yuqori", stage: "qayta", summary: summary ?? undefined }
        : { interest: meeting ? "yuqori" : "o'rta", stage: meeting ? "uchrashuv" : "qiziqdi", summary: summary ?? undefined, meeting }, "qo'ng'iroq");
    }
    await pushCall(q, orgId, callId, c.campaign_id);
    if (c.campaign_id) await settle(q, orgId, c.campaign_id);
    await pushUsage(q, orgId);
  });
}

/** Asks the dialer to place a claimed call. Its result arrives later on POST /api/hooks/dialer/:secret. */
async function dial(orgId: string, campaignId: string, call: { id: string; phone: string }, secret: string) {
  const cfg = config();
  const r = await fetch(`${cfg.DIALER_URL.replace(/\/$/, "")}/originate`, {
    method: "POST", signal: AbortSignal.timeout(10_000),
    headers: { "content-type": "application/json", authorization: `Bearer ${cfg.DIALER_TOKEN}` },
    body: JSON.stringify({ callId: call.id, phone: call.phone, callback: `${cfg.PUBLIC_URL.replace(/\/$/, "")}/api/hooks/dialer/${secret}` }),
  }).catch(() => null);
  if (r?.ok) return;
  // Only 400 and 422 refuse this number. Anything else (dialer down or busy, wrong token, older dialer without this
  // route) says nothing about the number: keep it queued, or one bad setting would burn the whole list.
  if (r?.status !== 400 && r?.status !== 422) {
    retryAt.set(campaignId, Date.now() + RETRY_MS);
    console.warn(`[qo'ng'iroq] dialer vaqtincha qabul qilmadi: ${r?.status ?? "javob yo'q"}`);
    await tx(orgId, async (q) => {
      await q.exec("update calls set status = 'queued', started_at = null where id = $1 and status = 'dialing'", [call.id]);
      await pushCall(q, orgId, call.id, campaignId);
    });
    return;
  }
  const why = await r!.json().then((j: { error?: string }) => j.error).catch(() => undefined);
  await finish(orgId, call.id, "failed", 0, `Dialer rad etdi: ${String(why ?? r!.status).slice(0, 200)}`);
}

const RETRY_MS = 15_000;
const retryAt = new Map<string, number>(); // campaign id → do not ask the dialer again before this time

/** Every 3 s: for each running campaign whose window is open, start the next queued call. */
export function startCampaignRunner(): void {
  setInterval(() => void tick().catch((e) => console.warn("[kampaniya]", (e as Error).message)), 3000).unref();
}

/** A call whose result never came would hold its campaign's line forever. */
async function reapStale() {
  const stale = await tx(SYSTEM, (q) => q.many<{ id: string; org_id: string }>(
    `select k.id, k.org_id from calls k join orgs o on o.id = k.org_id where k.status = 'dialing'
     and k.started_at < now() - make_interval(mins => case when o.demo then $1::int else $2::int end)`, [STALE_MINUTES.demo, STALE_MINUTES.real]));
  for (const k of stale) await finish(k.org_id, k.id, "failed", 0, "Dialer natija yubormadi");
}

async function tick() {
  await reapStale();
  // A real campaign without the consent confirmation never dials, even if something set it to running.
  const running = await tx(SYSTEM, (q) => q.many<{ id: string; org_id: string; demo: boolean; work_from: number; work_to: number; plan: string }>(
    "select p.id, p.org_id, o.demo, o.work_from, o.work_to, o.plan from campaigns p join orgs o on o.id = p.org_id where p.status = 'running' and (o.demo or p.consent_at is not null)"));
  for (const p of running) {
    if (!callWindowOpen(p) || (retryAt.get(p.id) ?? 0) > Date.now()) continue;
    if (!p.demo && !config().DIALER_URL) continue;
    const next = await tx(p.org_id, (q) => claimNext(q, p.org_id, p.id));
    if (!next) continue;
    const run = p.demo ? simulate(p.org_id, next.id) : dial(p.org_id, p.id, next, await dialerSecret(p.org_id));
    void run.catch((e) => console.warn("[qo'ng'iroq]", (e as Error).message));
  }
}

/** One line per campaign (v0.1): the next call starts only after the previous one has its result. */
async function claimNext(q: Q, orgId: string, campaignId: string) {
  if (await q.maybe("select 1 from calls where campaign_id = $1 and status = 'dialing' limit 1", [campaignId])) return null;
  if (!(await fits(q, orgId, "callMinutes"))) {
    await q.exec("update campaigns set status = 'paused' where id = $1", [campaignId]);
    emit(orgId, "campaign", await getCampaign(q, campaignId));
    return null;
  }
  const blocked = await q.many<{ id: string }>(
    `update calls k set status = 'blocked', ended_at = now(), summary = $2 from contacts c
     where k.campaign_id = $1 and k.status = 'queued' and c.id = k.contact_id
       and exists (select 1 from contacts d where d.phone = c.phone and d.do_not_call_at is not null) returning k.id`, [campaignId, BLOCKED_NOTE]);
  for (const b of blocked) emit(orgId, "call", await getCall(q, b.id));
  const k = await q.maybe<{ id: string }>(
    `update calls set status = 'dialing', started_at = now() where id = (
       select id from calls where campaign_id = $1 and status = 'queued' order by created_at limit 1 for update skip locked) returning id`, [campaignId]);
  if (!k) { await settle(q, orgId, campaignId); return null; }
  await pushCall(q, orgId, k.id, campaignId);
  const c = await q.one<{ phone: string }>("select c.phone from calls k join contacts c on c.id = k.contact_id where k.id = $1", [k.id]);
  return { id: k.id, phone: c.phone };
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
