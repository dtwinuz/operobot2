// MCP server (docs/04 §MCP): Streamable HTTP, JSON-RPC 2.0, one org per API key. Lets Claude / ChatGPT read the
// board, inbox and stats and act (move a lead, reply, start a call campaign) within the same tenant rules.
import { tx } from "./db.js";
import { emit } from "./bus.js";
import { sendOut } from "./flow.js";
import { CONV_SELECT, LEAD_SELECT, MSG_SELECT, getLead } from "./views.js";
import { usageOf } from "./billing/usage.js";

type Json = Record<string, any>;
const TOOLS = [
  { name: "lidlar", description: "Doskadagi lidlar: bosqich, qiziqish, keyingi qadam. Ixtiyoriy filtr: bosqich nomi yoki qidiruv.", inputSchema: { type: "object", properties: { bosqich: { type: "string" }, qidiruv: { type: "string" }, limit: { type: "number" } } } },
  { name: "lid_yangilash", description: "Lidni boshqa bosqichga o'tkazish yoki keyingi qadamni yozish.", inputSchema: { type: "object", required: ["lid_id"], properties: { lid_id: { type: "string" }, bosqich: { type: "string" }, keyingi_qadam: { type: "string" } } } },
  { name: "suhbatlar", description: "Inboxdagi ochiq suhbatlar (kanal, rejim AI/operator, o'qilmagan).", inputSchema: { type: "object", properties: { faqat_oqilmagan: { type: "boolean" } } } },
  { name: "suhbat_tarixi", description: "Bitta suhbatning xabarlari.", inputSchema: { type: "object", required: ["suhbat_id"], properties: { suhbat_id: { type: "string" } } } },
  { name: "xabar_yuborish", description: "Mijozga suhbat kanali orqali xabar yuborish (operator nomidan).", inputSchema: { type: "object", required: ["suhbat_id", "matn"], properties: { suhbat_id: { type: "string" }, matn: { type: "string" } } } },
  { name: "statistika", description: "Bugungi raqamlar, voronka va oylik limitlar.", inputSchema: { type: "object", properties: {} } },
];

const text = (v: unknown) => ({ content: [{ type: "text", text: typeof v === "string" ? v : JSON.stringify(v, null, 2) }] });

async function call(orgId: string, name: string, a: Json) {
  switch (name) {
    case "lidlar": return text(await tx(orgId, (q) => q.many(`${LEAD_SELECT} join stages s on s.id = l.stage_id
      where ($1::text is null or s.name ilike $1 or s.key ilike $1) and ($2::text is null or l.title ilike $2 or c.name ilike $2) order by l.updated_at desc limit $3`,
      [a.bosqich ? `%${a.bosqich}%` : null, a.qidiruv ? `%${a.qidiruv}%` : null, Math.min(200, Number(a.limit) || 50)])));
    case "lid_yangilash": {
      const lead = await tx(orgId, async (q) => {
        const st = a.bosqich ? await q.one<{ id: string }>("select id from stages where name ilike $1 or key ilike $1 limit 1", [a.bosqich]) : null;
        await q.one("update leads set stage_id = coalesce($2, stage_id), next_action = coalesce($3, next_action), updated_at = now() where id = $1 returning id", [a.lid_id, st?.id ?? null, a.keyingi_qadam ?? null]);
        return getLead(q, a.lid_id);
      });
      emit(orgId, "lead", lead);
      return text(lead);
    }
    case "suhbatlar": return text(await tx(orgId, (q) => q.many(`${CONV_SELECT} where v.status = 'open' and (not $1 or v.unread > 0) order by v.last_at desc nulls last limit 100`, [!!a.faqat_oqilmagan])));
    case "suhbat_tarixi": return text(await tx(orgId, (q) => q.many(`${MSG_SELECT} where m.conversation_id = $1 order by m.at limit 200`, [a.suhbat_id])));
    case "xabar_yuborish": {
      await tx(orgId, (q) => q.one("select 1 from conversations where id = $1", [a.suhbat_id]));
      return text(await sendOut(orgId, String(a.suhbat_id), String(a.matn).slice(0, 4000), "user"));
    }
    case "statistika": return text(await tx(orgId, async (q) => ({
      voronka: await q.many("select s.name, count(l.id)::int soni from stages s left join leads l on l.stage_id = s.id group by s.id order by s.position"),
      bugun: await q.one(`select (select count(*)::int from messages where direction = 'in' and at > now() - interval '24 hours') kiruvchi,
        (select count(*)::int from messages where author = 'ai' and at > now() - interval '24 hours') ai_javob,
        (select count(*)::int from calls where started_at > now() - interval '24 hours') qongiroq`),
      limitlar: await usageOf(q, orgId),
    })));
  }
  throw Object.assign(new Error(`Noma'lum tool: ${name}`), { rpc: -32602 });
}

export async function mcp(orgId: string, req: Json): Promise<Json | null> {
  const id = req.id ?? null;
  if (req.id === undefined && String(req.method).startsWith("notifications/")) return null;
  try {
    switch (req.method) {
      case "initialize": return { jsonrpc: "2.0", id, result: { protocolVersion: req.params?.protocolVersion ?? "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "operobot2", version: "0.1.0" } } };
      case "ping": return { jsonrpc: "2.0", id, result: {} };
      case "tools/list": return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
      case "tools/call": return { jsonrpc: "2.0", id, result: await call(orgId, String(req.params?.name), req.params?.arguments ?? {}) };
      default: return { jsonrpc: "2.0", id, error: { code: -32601, message: "Metod topilmadi" } };
    }
  } catch (e) {
    const x = e as Error & { rpc?: number };
    if (x.rpc) return { jsonrpc: "2.0", id, error: { code: x.rpc, message: x.message } };
    return { jsonrpc: "2.0", id, result: { isError: true, ...text(x.message) } };
  }
}
