// Session routes (docs/04): stats, board, contacts, inbox, channels, agents, calls, team, billing, settings, SSE.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Config } from "../config.js";
import { SYSTEM, tx } from "../db.js";
import { hashPassword, requireAuth, requireRole, sha, token } from "../auth.js";
import { subscribe } from "../bus.js";
import { emit } from "../bus.js";
import { connect, hookUrl, type Kind } from "../channels/adapters.js";
import { canSeal, hasCredentials, seal } from "../channels/secrets.js";
import { decide } from "../ai/brain.js";
import { sendOut, suggest } from "../flow.js";
import { PLANS, plan, price } from "../billing/plans.js";
import { fits, limitError, periodStart, usageOf } from "../billing/usage.js";
import { checkout } from "../billing/pay.js";
import { AGENT_SELECT, CALL_SELECT, CAMPAIGN_SELECT, CONV_SELECT, LEAD_SELECT, MSG_SELECT, getCampaign, getConv, getLead } from "../views.js";
import { findPhone } from "../ai/brain.js";

const err = (code: number, m: string) => Object.assign(new Error(m), { statusCode: code });
const id = z.object({ id: z.string().uuid() });
const admin = requireRole("owner", "admin");

export function appRoutes(app: FastifyInstance, cfg: Config): void {
  app.register(async (r) => {
    r.addHook("preHandler", requireAuth);

    // ---- real time
    r.get("/api/events", async (req, reply) => {
      reply.raw.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive", "x-accel-buffering": "no" });
      reply.raw.write(": ok\n\n");
      const off = subscribe(req.ctx.orgId, reply);
      req.raw.on("close", off);
      return reply.hijack();
    });

    // ---- dashboard
    r.get("/api/stats", async (req) => req.db(async (q) => {
      const day = "date_trunc('day', now() at time zone 'Asia/Tashkent') at time zone 'Asia/Tashkent'";
      const today = await q.one(`select
        (select count(*)::int from messages where direction = 'in' and at >= ${day}) inbound,
        (select count(*)::int from messages where direction = 'out' and author in ('ai','user') and at >= ${day}) outbound,
        (select count(*)::int from messages where author = 'ai' and at >= ${day}) "aiReplies",
        (select round(avg(extract(epoch from first_reply_at - first_in_at)))::int from conversations where first_reply_at is not null and first_in_at >= now() - interval '7 days') "firstReplySec",
        (select count(*)::int from calls where started_at >= ${day}) calls,
        (select count(*)::int from calls where status = 'connected' and started_at >= ${day}) connected,
        (select count(*)::int from leads where created_at >= ${day}) "newLeads",
        (select count(*)::int from leads l join stages s on s.id = l.stage_id where s.kind = 'won' and l.updated_at >= ${day}) won`);
      const byChannel = await q.many(`select ch.kind, count(m.id)::int count from channels ch left join conversations v on v.channel_id = ch.id
        left join messages m on m.conversation_id = v.id and m.direction = 'in' and m.at >= now() - interval '7 days' group by ch.kind order by count desc`);
      const hourly = await q.many(`select h, coalesce(i.n, 0)::int inbound, coalesce(c.n, 0)::int calls from generate_series(0, 23) h
        left join (select extract(hour from at at time zone 'Asia/Tashkent')::int hh, count(*) n from messages where direction = 'in' and at >= now() - interval '7 days' group by 1) i on i.hh = h
        left join (select extract(hour from started_at at time zone 'Asia/Tashkent')::int hh, count(*) n from calls where started_at >= now() - interval '7 days' group by 1) c on c.hh = h order by h`);
      const funnel = await q.many(`select s.id "stageId", s.name, s.color, count(l.id)::int count from stages s left join leads l on l.stage_id = s.id group by s.id order by s.position`);
      return { today, byChannel, hourly, funnel };
    }));

    // ---- board
    r.get("/api/stages", async (req) => req.db((q) => q.many(`select id, key, name, color, position, kind from stages order by position`)));
    r.get("/api/leads", async (req) => {
      const { q: s, stage } = z.object({ q: z.string().optional(), stage: z.string().uuid().optional() }).parse(req.query);
      return req.db((q) => q.many(`${LEAD_SELECT} where ($1::text is null or l.title ilike $1 or c.name ilike $1 or c.phone ilike $1) and ($2::uuid is null or l.stage_id = $2)
        order by l.updated_at desc limit 500`, [s ? `%${s}%` : null, stage ?? null]));
    });
    r.post("/api/leads", async (req) => {
      const b = z.object({ title: z.string().trim().min(1).max(160), name: z.string().trim().min(1).max(120), phone: z.string().trim().max(40).optional(), value: z.number().int().nonnegative().nullable().optional() }).parse(req.body);
      const lead = await req.db(async (q) => {
        const ph = b.phone ? findPhone(b.phone) ?? b.phone : null;
        const c = (ph && await q.maybe<{ id: string }>("select id from contacts where phone = $1 limit 1", [ph]))
          || await q.one<{ id: string }>("insert into contacts(org_id, name, phone) values ($1,$2,$3) returning id", [req.ctx.orgId, b.name, ph]);
        const st = await q.one<{ id: string }>("select id from stages order by position limit 1");
        const l = await q.one<{ id: string }>("insert into leads(org_id, contact_id, stage_id, title, value, assignee_id) values ($1,$2,$3,$4,$5,$6) returning id", [req.ctx.orgId, c.id, st.id, b.title, b.value ?? null, req.ctx.userId]);
        return getLead(q, l.id);
      });
      emit(req.ctx.orgId, "lead", lead);
      return lead;
    });
    r.patch("/api/leads/:id", async (req) => {
      const { id: lid } = id.parse(req.params);
      const b = z.object({ stageId: z.string().uuid().optional(), title: z.string().trim().min(1).max(160).optional(), value: z.number().int().nonnegative().nullable().optional(),
        interest: z.enum(["yuqori", "o'rta", "past"]).nullable().optional(), nextAction: z.string().max(300).nullable().optional(), dueAt: z.string().datetime({ offset: true }).nullable().optional(),
        assigneeId: z.string().uuid().nullable().optional() }).parse(req.body);
      const lead = await req.db(async (q) => {
        const sets: string[] = []; const vals: unknown[] = [lid];
        const put = (col: string, v: unknown) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
        if (b.stageId !== undefined) { await q.one("select 1 from stages where id = $1", [b.stageId]); put("stage_id", b.stageId); }
        if (b.title !== undefined) put("title", b.title);
        if (b.value !== undefined) put("value", b.value);
        if (b.interest !== undefined) put("interest", b.interest);
        if (b.nextAction !== undefined) put("next_action", b.nextAction);
        if (b.dueAt !== undefined) put("due_at", b.dueAt);
        if (b.assigneeId !== undefined) put("assignee_id", b.assigneeId);
        await q.one(`update leads set ${[...sets, "updated_at = now()"].join(", ")} where id = $1 returning id`, vals);
        return getLead(q, lid);
      });
      emit(req.ctx.orgId, "lead", lead);
      return lead;
    });

    // ---- contacts
    r.get("/api/contacts", async (req) => {
      const { q: s } = z.object({ q: z.string().optional() }).parse(req.query);
      return req.db((q) => q.many(`select c.id, c.name, c.phone, c.username, c.channel, c.tags, c.created_at "createdAt", c.last_seen_at "lastSeenAt",
        (select count(*)::int from leads l where l.contact_id = c.id) leads from contacts c
        where ($1::text is null or c.name ilike $1 or c.phone ilike $1 or c.username ilike $1) order by coalesce(c.last_seen_at, c.created_at) desc limit 500`, [s ? `%${s}%` : null]));
    });
    r.get("/api/contacts/:id", async (req) => {
      const { id: cid } = id.parse(req.params);
      return req.db(async (q) => {
        const c = await q.one(`select c.id, c.name, c.phone, c.username, c.channel, c.tags, c.created_at "createdAt", c.last_seen_at "lastSeenAt",
          (select count(*)::int from leads l where l.contact_id = c.id) leads from contacts c where c.id = $1`, [cid]);
        return { ...c, conversations: await q.many(`${CONV_SELECT} where v.contact_id = $1 order by v.last_at desc nulls last`, [cid]),
          calls: await q.many(`${CALL_SELECT} where k.contact_id = $1 order by k.created_at desc`, [cid]),
          leads: await q.many(`${LEAD_SELECT} where l.contact_id = $1 order by l.updated_at desc`, [cid]) };
      });
    });

    // ---- inbox
    r.get("/api/conversations", async (req) => {
      const { filter = "all", q: s } = z.object({ filter: z.enum(["all", "unread", "mine", "ai"]).optional(), q: z.string().optional() }).parse(req.query);
      const where = { all: "true", unread: "v.unread > 0", mine: "v.assignee_id = $2", ai: "v.mode = 'ai'" }[filter];
      return req.db((q) => q.many(`${CONV_SELECT} where ${where} and ($1::text is null or c.name ilike $1 or v.last_text ilike $1 or c.phone ilike $1)
        and ($2::uuid is not null) order by v.last_at desc nulls last limit 300`, [s ? `%${s}%` : null, req.ctx.userId]));
    });
    r.get("/api/conversations/:id/messages", async (req) => {
      const { id: cid } = id.parse(req.params);
      return req.db(async (q) => {
        await q.one("update conversations set unread = 0 where id = $1 returning id", [cid]);
        return q.many(`${MSG_SELECT} where m.conversation_id = $1 order by m.at limit 500`, [cid]);
      });
    });
    r.post("/api/conversations/:id/messages", async (req) => {
      const { id: cid } = id.parse(req.params);
      const { text } = z.object({ text: z.string().trim().min(1).max(4000) }).parse(req.body);
      if (!(await req.db((q) => fits(q, req.ctx.orgId, "messages")))) throw limitError("xabarlar");
      await req.db((q) => q.one("select 1 from conversations where id = $1", [cid]));
      return sendOut(req.ctx.orgId, cid, text, "user", req.ctx.userId);
    });
    r.patch("/api/conversations/:id", async (req) => {
      const { id: cid } = id.parse(req.params);
      const b = z.object({ mode: z.enum(["ai", "human"]).optional(), assigneeId: z.string().uuid().nullable().optional(), status: z.enum(["open", "closed"]).optional() }).parse(req.body);
      const conv = await req.db(async (q) => {
        await q.one(`update conversations set mode = coalesce($2, mode), status = coalesce($3, status),
          assignee_id = case when $4 then $5::uuid else assignee_id end where id = $1 returning id`, [cid, b.mode ?? null, b.status ?? null, b.assigneeId !== undefined, b.assigneeId ?? null]);
        return getConv(q, cid);
      });
      emit(req.ctx.orgId, "conversation", conv);
      return conv;
    });
    r.post("/api/conversations/:id/suggest", async (req) => {
      const { id: cid } = id.parse(req.params);
      await req.db((q) => q.one("select 1 from conversations where id = $1", [cid]));
      return { text: await suggest(req.ctx.orgId, cid) };
    });

    // ---- channels
    const chanOut = (c: Record<string, unknown>) => ({ id: c.id, kind: c.kind, name: c.name, status: c.status, info: c.info, webhookUrl: hookUrl(cfg, c as { kind: Kind; secret: string }), widgetKey: c.widget_key, createdAt: c.created_at });
    r.get("/api/channels", async (req) => (await req.db((q) => q.many("select * from channels order by created_at"))).map(chanOut));
    r.post("/api/channels", { preHandler: admin }, async (req) => {
      const b = z.object({ kind: z.enum(["telegram", "whatsapp", "instagram", "sms", "widget"]), name: z.string().trim().min(1).max(80), config: z.record(z.string(), z.string().max(500)).default({}) }).parse(req.body);
      if (!(await req.db((q) => fits(q, req.ctx.orgId, "channels")))) throw limitError("kanallar soni");
      if (!req.ctx.demo && b.kind !== "widget" && !Object.values(b.config).some((v) => v.trim())) throw err(400, "Kanal ma'lumotlari kerak (token va h.k.)");
      if (hasCredentials(b.config) && !canSeal()) throw err(409, "Kanal ulash hozircha o'chiq: serverda CHANNEL_KEY sozlanmagan");
      const secret = token(18);
      const st = await connect(cfg, b.kind, b.config, secret);
      const row = await req.db((q) => q.one("insert into channels(org_id, kind, name, status, config, secret, widget_key, info) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *",
        [req.ctx.orgId, b.kind, b.name, st.status, seal(req.ctx.orgId, b.config), secret, b.kind === "widget" ? token(12) : null, st.info]));
      return chanOut(row);
    });
    r.delete("/api/channels/:id", { preHandler: admin }, async (req) => {
      const { id: cid } = id.parse(req.params);
      await req.db((q) => q.one("delete from channels where id = $1 returning id", [cid]));
      return { ok: true };
    });

    // ---- agents
    const agentBody = z.object({ name: z.string().trim().min(1).max(60), kind: z.enum(["chat", "voice"]).default("chat"), enabled: z.boolean().default(true), prompt: z.string().max(4000).default(""),
      greeting: z.string().max(500).default(""), handoff: z.array(z.string().max(60)).max(20).default([]), channelIds: z.array(z.string().uuid()).max(20).default([]), voice: z.string().max(60).nullable().default(null) });
    r.get("/api/agents", async (req) => req.db((q) => q.many(`${AGENT_SELECT} order by created_at`)));
    r.post("/api/agents", { preHandler: admin }, async (req) => {
      const b = agentBody.parse(req.body);
      return req.db(async (q) => {
        const a = await q.one<{ id: string }>("insert into agents(org_id, name, kind, enabled, prompt, greeting, handoff, channel_ids, voice) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id",
          [req.ctx.orgId, b.name, b.kind, b.enabled, b.prompt, b.greeting, b.handoff, b.channelIds, b.voice]);
        return q.one(`${AGENT_SELECT} where id = $1`, [a.id]);
      });
    });
    r.patch("/api/agents/:id", { preHandler: admin }, async (req) => {
      const { id: aid } = id.parse(req.params);
      const b = agentBody.partial().parse(req.body);
      return req.db(async (q) => {
        const cur = await q.one<Record<string, unknown>>(`${AGENT_SELECT} where id = $1`, [aid]);
        const m = { ...cur, ...Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined)) } as z.infer<typeof agentBody>;
        await q.exec("update agents set name=$2, kind=$3, enabled=$4, prompt=$5, greeting=$6, handoff=$7, channel_ids=$8, voice=$9 where id = $1",
          [aid, m.name, m.kind, m.enabled, m.prompt, m.greeting, m.handoff, m.channelIds, m.voice]);
        return q.one(`${AGENT_SELECT} where id = $1`, [aid]);
      });
    });
    r.post("/api/agents/:id/test", async (req) => {
      const { id: aid } = id.parse(req.params);
      const { text } = z.object({ text: z.string().trim().min(1).max(1000) }).parse(req.body);
      const a = await req.db((q) => q.one<{ name: string; prompt: string; greeting: string; handoff: string[] }>(`${AGENT_SELECT} where id = $1`, [aid]));
      const d = await decide(cfg, a, req.ctx.orgName, [{ who: "contact", text }]);
      return { reply: d.reply, action: d.action, extracted: d.extracted };
    });

    // ---- calls
    r.get("/api/campaigns", async (req) => req.db((q) => q.many(`${CAMPAIGN_SELECT} group by p.id order by p.created_at desc`)));
    r.post("/api/campaigns", { preHandler: admin }, async (req) => {
      const b = z.object({ name: z.string().trim().min(1).max(120), agentId: z.string().uuid().nullable().optional(), phones: z.array(z.string().max(40)).min(1).max(5000) }).parse(req.body);
      const phones = [...new Set(b.phones.map((p) => findPhone(p)).filter((p): p is string => !!p))];
      if (!phones.length) throw err(400, "Telefon raqamlar topilmadi (+998 XX XXX XX XX)");
      return req.db(async (q) => {
        const p = await q.one<{ id: string }>("insert into campaigns(org_id, name, agent_id) values ($1,$2,$3) returning id", [req.ctx.orgId, b.name, b.agentId ?? null]);
        for (const ph of phones) {
          const c = (await q.maybe<{ id: string }>("select id from contacts where phone = $1 limit 1", [ph])) ?? await q.one<{ id: string }>("insert into contacts(org_id, name, phone) values ($1,$2,$2) returning id", [req.ctx.orgId, ph]);
          await q.exec("insert into calls(org_id, campaign_id, contact_id) values ($1,$2,$3)", [req.ctx.orgId, p.id, c.id]);
        }
        return getCampaign(q, p.id);
      });
    });
    for (const [act, status] of [["start", "running"], ["pause", "paused"]] as const) {
      r.post(`/api/campaigns/:id/${act}`, { preHandler: admin }, async (req) => {
        const { id: pid } = id.parse(req.params);
        if (act === "start" && !req.ctx.demo) {
          if (!cfg.DIALER_URL) throw err(409, "Dialer ulanmagan (DIALER_URL). Qo'ng'iroq faqat demo rejimida simulyatsiya qilinadi");
          if ((plan(req.ctx.plan).limits.callMinutes) === 0) throw limitError("qo'ng'iroq daqiqalari");
        }
        const c = await req.db(async (q) => { await q.one("update campaigns set status = $2 where id = $1 and status <> 'done' returning id", [pid, status]); return getCampaign(q, pid); });
        emit(req.ctx.orgId, "campaign", c);
        return c;
      });
    }
    r.get("/api/calls", async (req) => {
      const { campaignId, limit = 100 } = z.object({ campaignId: z.string().uuid().optional(), limit: z.coerce.number().int().min(1).max(500).optional() }).parse(req.query);
      return req.db((q) => q.many(`${CALL_SELECT} where ($1::uuid is null or k.campaign_id = $1) order by coalesce(k.started_at, k.created_at) desc limit $2`, [campaignId ?? null, limit]));
    });

    // ---- team
    r.get("/api/members", async (req) => tx(SYSTEM, (q) => q.many(`select u.id "userId", u.name, u.email, m.role, m.last_seen_at "lastSeenAt"
      from memberships m join users u on u.id = m.user_id where m.org_id = $1 order by m.created_at`, [req.ctx.orgId])));
    r.post("/api/members", { preHandler: admin }, async (req) => {
      const b = z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().toLowerCase().email(), role: z.enum(["admin", "operator"]) }).parse(req.body);
      if (!(await req.db((q) => fits(q, req.ctx.orgId, "operators")))) throw limitError("operatorlar soni");
      const temp = token(9);
      const hash = await hashPassword(temp);
      return tx(SYSTEM, async (q) => {
        let u = await q.maybe<{ id: string }>("select id from users where email = $1", [b.email]);
        const fresh = !u;
        if (!u) u = await q.one<{ id: string }>("insert into users(email, name, password_hash, demo) values ($1,$2,$3,$4) returning id", [b.email, b.name, hash, req.ctx.demo]);
        if (await q.maybe("select 1 from memberships where org_id = $1 and user_id = $2", [req.ctx.orgId, u.id])) throw err(409, "Bu foydalanuvchi allaqachon jamoada");
        await q.exec("insert into memberships(org_id, user_id, role) values ($1,$2,$3)", [req.ctx.orgId, u.id, b.role]);
        return { member: { userId: u.id, name: b.name, email: b.email, role: b.role, lastSeenAt: null }, tempPassword: fresh ? temp : null };
      });
    });
    r.patch("/api/members/:userId", { preHandler: admin }, async (req) => {
      const { userId } = z.object({ userId: z.string().uuid() }).parse(req.params);
      const { role } = z.object({ role: z.enum(["admin", "operator"]) }).parse(req.body);
      await tx(SYSTEM, (q) => q.one("update memberships set role = $3 where org_id = $1 and user_id = $2 and role <> 'owner' returning user_id", [req.ctx.orgId, userId, role]));
      return { ok: true };
    });
    r.delete("/api/members/:userId", { preHandler: admin }, async (req) => {
      const { userId } = z.object({ userId: z.string().uuid() }).parse(req.params);
      await tx(SYSTEM, (q) => q.one("delete from memberships where org_id = $1 and user_id = $2 and role <> 'owner' returning user_id", [req.ctx.orgId, userId]));
      return { ok: true };
    });

    // ---- billing
    r.get("/api/billing", async (req) => req.db(async (q) => {
      const o = await q.one<{ plan: string; plan_until: string | null }>("select plan, plan_until from orgs where id = $1", [req.ctx.orgId]);
      const start = periodStart();
      const end = new Date(Date.UTC(+start.slice(0, 4), +start.slice(5, 7), 1)).toISOString().slice(0, 10);
      return { plan: plan(o.plan), periodStart: start, periodEnd: end, planUntil: o.plan_until, usage: await usageOf(q, req.ctx.orgId), plans: PLANS,
        invoices: await q.many(`select id, plan, months, amount, provider, status, created_at "createdAt" from invoices order by created_at desc limit 50`) };
    }));
    r.post("/api/billing/checkout", { preHandler: requireRole("owner") }, async (req) => {
      const b = z.object({ plan: z.enum(["start", "biznes", "pro", "korporativ"]), months: z.union([z.literal(1), z.literal(12)]), provider: z.enum(["payme", "click"]) }).parse(req.body);
      const p = plan(b.plan);
      if (p.priceMonth === null) throw err(400, "Korporativ tarif bo'yicha biz bilan bog'laning");
      return checkout(cfg, req.ctx.orgId, req.ctx.demo, p, b.months, price(p, b.months), b.provider);
    });

    // ---- settings
    r.get("/api/settings", async (req) => tx(SYSTEM, (q) => q.one(`select name, timezone, work_from "workFrom", work_to "workTo", api_key_prefix "apiKeyPrefix", api_key_at "apiKeyAt" from orgs where id = $1`, [req.ctx.orgId])));
    r.patch("/api/settings", { preHandler: admin }, async (req) => {
      const b = z.object({ name: z.string().trim().min(2).max(120).optional(), timezone: z.string().max(60).optional(), workFrom: z.number().int().min(0).max(23).optional(), workTo: z.number().int().min(1).max(24).optional() }).parse(req.body);
      return tx(SYSTEM, (q) => q.one(`update orgs set name = coalesce($2, name), timezone = coalesce($3, timezone), work_from = coalesce($4, work_from), work_to = coalesce($5, work_to)
        where id = $1 returning name, timezone, work_from "workFrom", work_to "workTo", api_key_prefix "apiKeyPrefix", api_key_at "apiKeyAt"`, [req.ctx.orgId, b.name ?? null, b.timezone ?? null, b.workFrom ?? null, b.workTo ?? null]));
    });
    r.post("/api/settings/api-key", { preHandler: admin }, async (req) => {
      const prefix = token(4).replace(/[^A-Za-z0-9]/g, "x").slice(0, 6);
      const key = `ob2_${prefix}_${token(24)}`;
      await tx(SYSTEM, (q) => q.exec("update orgs set api_key_hash = $2, api_key_prefix = $3, api_key_at = now() where id = $1", [req.ctx.orgId, sha(key), `ob2_${prefix}`]));
      return { key };
    });
  });
}
