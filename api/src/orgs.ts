// Tenant bootstrap: a new org gets the default pipeline, a website widget channel and one chat agent.
import type { Q } from "./db.js";
import { token } from "./auth.js";

export const DEFAULT_STAGES = [
  { key: "yangi", name: "Yangi", color: "#0891b2", kind: "open" },
  { key: "qiziqdi", name: "Qiziqdi", color: "#7c3aed", kind: "open" },
  { key: "uchrashuv", name: "Uchrashuv", color: "#d97706", kind: "open" },
  { key: "qayta", name: "Qayta bog'lanish", color: "#64748b", kind: "open" },
  { key: "yutildi", name: "Yutildi", color: "#059669", kind: "won" },
  { key: "yutqazildi", name: "Yutqazildi", color: "#db2777", kind: "lost" },
] as const;

export const AGENT_PROMPT = "Mijozning ehtiyojini aniqlang, qisqa javob bering, telefon raqami va qulay vaqtini so'rang. Narxni o'ylab topmang: aniq narxni menejer aytadi.";

/** Creates org + owner membership + defaults. Run inside tx(SYSTEM). */
export async function createOrg(q: Q, name: string, ownerId: string, opts: { plan?: string; demo?: boolean } = {}): Promise<string> {
  const org = await q.one<{ id: string }>("insert into orgs(name, plan, demo) values ($1, $2, $3) returning id", [name, opts.plan ?? "start", !!opts.demo]);
  await q.exec("insert into memberships(org_id, user_id, role) values ($1, $2, 'owner')", [org.id, ownerId]);
  for (const [i, s] of DEFAULT_STAGES.entries())
    await q.exec("insert into stages(org_id, key, name, color, position, kind) values ($1,$2,$3,$4,$5,$6)", [org.id, s.key, s.name, s.color, i, s.kind]);
  await q.exec("insert into channels(org_id, kind, name, status, secret, widget_key, info) values ($1, 'widget', 'Sayt vidjeti', 'connected', $2, $3, 'Sayt vidjeti: kodni saytingizga qo''ying')",
    [org.id, token(18), token(12)]);
  await q.exec("insert into agents(org_id, name, kind, prompt, greeting, handoff) values ($1, 'Zarina', 'chat', $2, $3, $4)",
    [org.id, AGENT_PROMPT, `Assalomu alaykum! ${name} yordamchisi Zarina. Sizga qanday yordam bera olaman?`, ["operator", "odam bilan", "menejer"]]);
  return org.id;
}
