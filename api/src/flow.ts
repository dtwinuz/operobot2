// Message flow (docs/02 §Oqim): inbound → contact/conversation/lead → AI agent → reply via the same channel.
import type { Config } from "./config.js";
import { SYSTEM, tx, type Q } from "./db.js";
import { emit } from "./bus.js";
import { send, type ChannelRow, type Inbound } from "./channels/adapters.js";
import { decide, type Decision, type Turn } from "./ai/brain.js";
import { bump, fits, pushUsage } from "./billing/usage.js";
import { getConv, getLead, MSG_SELECT } from "./views.js";

let cfg: Config;
export const initFlow = (c: Config) => { cfg = c; };
export const config = () => cfg;

const stageId = (q: Q, orgId: string, key: string) => q.maybe<{ id: string }>("select id from stages where org_id = $1 and key = $2", [orgId, key]);

async function pushConv(q: Q, orgId: string, convId: string) { emit(orgId, "conversation", await getConv(q, convId)); }
async function pushLead(q: Q, orgId: string, leadId: string) { emit(orgId, "lead", await getLead(q, leadId)); }

async function addMessage(q: Q, orgId: string, convId: string, m: { direction: "in" | "out"; author: string; text: string; status: string; userId?: string | null; externalId?: string }) {
  const r = await q.one<{ id: string }>(
    "insert into messages(org_id, conversation_id, direction, author, user_id, text, status, external_id) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id",
    [orgId, convId, m.direction, m.author, m.userId ?? null, m.text, m.status, m.externalId ?? null]);
  await q.exec(
    `update conversations set last_text = $2, last_at = now(), last_dir = $3,
       unread = case when $3 = 'in' then unread + 1 else unread end,
       first_in_at = coalesce(first_in_at, case when $3 = 'in' then now() end),
       first_reply_at = coalesce(first_reply_at, case when $3 = 'out' and $4 <> 'system' then now() end),
       status = case when $3 = 'in' then 'open' else status end
     where id = $1`, [convId, m.text.slice(0, 300), m.direction, m.author]);
  const msg = await q.one(`${MSG_SELECT} where m.id = $1`, [r.id]);
  emit(orgId, "message", { conversationId: convId, message: msg });
  return msg;
}

/** Inbound from any channel. Runs as SYSTEM (webhooks have no session) but every row carries the channel's org_id. */
export async function handleInbound(ch: ChannelRow, m: Inbound): Promise<string> {
  const orgId = ch.org_id;
  const convId = await tx(orgId, async (q) => {
    if (m.messageId && await q.maybe("select 1 from messages where org_id = $1 and external_id = $2 and direction = 'in'", [orgId, `${ch.id}:${m.messageId}`])) return null; // platform retry
    const contact = await q.one<{ id: string }>(
      `insert into contacts(org_id, name, phone, username, channel, external_id, last_seen_at) values ($1,$2,$3,$4,$5,$6, now())
       on conflict (org_id, channel, external_id) do update set last_seen_at = now(),
         phone = coalesce(contacts.phone, excluded.phone), username = coalesce(excluded.username, contacts.username)
       returning id`, [orgId, m.name.slice(0, 120), m.phone ?? null, m.username ?? null, ch.kind, m.externalId]);
    const conv = (await q.maybe<{ id: string; lead_id: string | null }>(
      "select id, lead_id from conversations where contact_id = $1 and channel_id = $2 order by created_at desc limit 1", [contact.id, ch.id]))
      ?? await q.one<{ id: string; lead_id: string | null }>("insert into conversations(org_id, contact_id, channel_id) values ($1,$2,$3) returning id, lead_id", [orgId, contact.id, ch.id]);
    if (!conv.lead_id) {
      const st = await stageId(q, orgId, "yangi");
      const lead = await q.one<{ id: string }>(
        "insert into leads(org_id, contact_id, conversation_id, stage_id, title, source) values ($1,$2,$3,$4,$5,$6) returning id",
        [orgId, contact.id, conv.id, st!.id, `${m.name.slice(0, 60)} · ${ch.name}`, ch.kind]);
      await q.exec("update conversations set lead_id = $2 where id = $1", [conv.id, lead.id]);
      await pushLead(q, orgId, lead.id);
    }
    await addMessage(q, orgId, conv.id, { direction: "in", author: "contact", text: m.text, status: "received", externalId: m.messageId ? `${ch.id}:${m.messageId}` : undefined });
    await bump(q, orgId, "messages");
    await pushConv(q, orgId, conv.id);
    return conv.id;
  });
  if (convId) setTimeout(() => void runAgent(orgId, convId).catch((e) => console.warn("[ai]", (e as Error).message)), 900);
  return convId ?? "";
}

export async function sendOut(orgId: string, convId: string, text: string, author: "user" | "ai" | "system", userId?: string) {
  return tx(orgId, async (q) => {
    const row = await q.one<{ ch: ChannelRow; external_id: string | null; phone: string | null }>(
      `select row_to_json(ch.*) ch, c.external_id, c.phone from conversations v join channels ch on ch.id = v.channel_id
       join contacts c on c.id = v.contact_id where v.id = $1`, [convId]);
    const r = author === "system" ? { status: "sent" as const } : await send(row.ch, { externalId: row.external_id, phone: row.phone }, text);
    const msg = await addMessage(q, orgId, convId, { direction: "out", author, text, status: r.status, userId });
    if (author === "user") await q.exec("update conversations set mode = 'human', unread = 0, assignee_id = coalesce(assignee_id, $2) where id = $1", [convId, userId]);
    if (author !== "system") await bump(q, orgId, "messages");
    await pushConv(q, orgId, convId);
    if (r.status === "failed") console.warn(`[kanal] ${row.ch.kind} yuborilmadi: ${r.error}`);
    return msg;
  });
}

async function history(q: Q, convId: string): Promise<Turn[]> {
  const rows = await q.many<{ author: Turn["who"]; text: string }>("select author, text from messages where conversation_id = $1 order by at desc limit 20", [convId]);
  return rows.reverse().map((r) => ({ who: r.author, text: r.text }));
}

async function agentFor(q: Q, orgId: string, channelId: string) {
  return q.maybe<{ id: string; name: string; prompt: string; greeting: string; handoff: string[]; org_name: string }>(
    `select a.id, a.name, a.prompt, a.greeting, a.handoff, o.name org_name from agents a join orgs o on o.id = a.org_id
     where a.org_id = $1 and a.kind = 'chat' and a.enabled and (cardinality(a.channel_ids) = 0 or $2 = any(a.channel_ids))
     order by a.created_at limit 1`, [orgId, channelId]);
}

/** Applies what the agent understood to the lead: interest, stage, next step, due time, phone/name on the contact. */
export async function applyExtracted(q: Q, orgId: string, leadId: string, d: Decision["extracted"], who: string) {
  const lead = await q.maybe<{ contact_id: string; stage_key: string }>(
    "select l.contact_id, s.key stage_key from leads l join stages s on s.id = l.stage_id where l.id = $1", [leadId]);
  if (!lead) return;
  const target = d.stage === "qayta" ? "qayta" : d.stage;
  const closed = lead.stage_key === "yutildi" || lead.stage_key === "yutqazildi";
  const st = target && !closed ? await stageId(q, orgId, target) : undefined;
  await q.exec(
    `update leads set interest = coalesce($2, interest), stage_id = coalesce($3, stage_id), summary = coalesce($4, summary),
       due_at = coalesce($5, due_at), next_action = coalesce($6, next_action), updated_at = now() where id = $1`,
    [leadId, d.interest ?? null, st?.id ?? null, d.summary ? `${d.summary} (${who})` : null, d.meeting ?? null,
      d.meeting ? "Uchrashuvni tasdiqlash, bir kun oldin eslatma" : d.phone ? "Qo'ng'iroq qilish" : d.stage === "qayta" ? "Qayta bog'lanish" : null]);
  if (d.phone || d.name) await q.exec("update contacts set phone = coalesce(phone, $2), name = case when $3::text is null then name else $3 end where id = $1", [lead.contact_id, d.phone ?? null, d.name ?? null]);
  await pushLead(q, orgId, leadId);
}

export async function runAgent(orgId: string, convId: string): Promise<void> {
  const prep = await tx(orgId, async (q) => {
    const conv = await q.maybe<{ mode: string; channel_id: string; lead_id: string | null }>("select mode, channel_id, lead_id from conversations where id = $1", [convId]);
    if (!conv || conv.mode !== "ai") return null;
    const agent = await agentFor(q, orgId, conv.channel_id);
    if (!agent) return null;
    if (!(await fits(q, orgId, "aiReplies"))) {
      await q.exec("update conversations set mode = 'human' where id = $1", [convId]);
      return { limit: true as const };
    }
    return { agent, conv, hist: await history(q, convId) };
  });
  if (!prep) return;
  if ("limit" in prep) { await sendOut(orgId, convId, "AI javob limiti tugadi, suhbat operatorga o'tdi.", "system"); return; }
  const d = await decide(cfg, prep.agent, prep.agent.org_name, prep.hist);
  await sendOut(orgId, convId, d.reply, "ai");
  await tx(orgId, async (q) => {
    await bump(q, orgId, "ai_replies");
    await q.exec("update agents set replies = replies + 1, handoffs = handoffs + $2 where id = $1", [prep.agent.id, d.action === "handoff" ? 1 : 0]);
    if (prep.conv.lead_id) await applyExtracted(q, orgId, prep.conv.lead_id, d.extracted, `AI ${prep.agent.name}`);
    if (d.action === "handoff") await q.exec("update conversations set mode = 'human' where id = $1", [convId]);
    await pushUsage(q, orgId);
  });
  if (d.action === "handoff") await sendOut(orgId, convId, `${prep.agent.name} suhbatni operatorga topshirdi.`, "system");
}

/** Draft reply for the operator (POST /conversations/:id/suggest): same brain, nothing is sent. */
export async function suggest(orgId: string, convId: string): Promise<string> {
  const { agent, hist } = await tx(orgId, async (q) => {
    const conv = await q.one<{ channel_id: string }>("select channel_id from conversations where id = $1", [convId]);
    const agent = (await agentFor(q, orgId, conv.channel_id)) ?? { id: "", name: "Yordamchi", prompt: "", greeting: "", handoff: [], org_name: "" };
    return { agent, hist: await history(q, convId) };
  });
  return (await decide(cfg, { ...agent, handoff: ["\u0000"] }, agent.org_name, hist)).reply;
}

export const channelBySecret = (kind: string, secret: string) =>
  tx(SYSTEM, (q) => q.maybe<ChannelRow>("select * from channels where kind = $1 and secret = $2", [kind, secret]));
export const channelByWidget = (key: string) =>
  tx(SYSTEM, (q) => q.maybe<ChannelRow>("select * from channels where kind = 'widget' and widget_key = $1", [key]));
