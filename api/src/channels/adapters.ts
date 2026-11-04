// Channel adapters (docs/05 §Kanallar): connect (validate + register webhook), send, parse incoming webhook.
// A channel without credentials is a "demo" channel: sends are recorded with status "demo" and never leave the server.
import type { Config } from "../config.js";

export type Kind = "telegram" | "whatsapp" | "instagram" | "sms" | "widget";
export interface ChannelRow { id: string; org_id: string; kind: Kind; name: string; status: string; config: Record<string, string>; secret: string; widget_key: string | null }
export interface Inbound { externalId: string; name: string; username?: string; phone?: string; text: string; messageId?: string }
export type SendResult = { status: "sent" | "demo" | "failed"; externalId?: string; error?: string };

const GRAPH = "https://graph.facebook.com/v21.0";
const isDemo = (ch: ChannelRow) => ch.status === "demo";

async function post(url: string, body: unknown, headers: Record<string, string> = {}): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const r = await fetch(url, { method: "POST", signal: AbortSignal.timeout(15_000), headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: r.ok, status: r.status, json };
}

export const hookUrl = (cfg: Config, ch: Pick<ChannelRow, "kind" | "secret">) =>
  ch.kind === "widget" ? null : `${cfg.PUBLIC_URL.replace(/\/$/, "")}/api/hooks/${ch.kind}/${ch.secret}`;

/** Validates credentials and registers the webhook where the platform allows it. Returns status + human info. */
export async function connect(cfg: Config, kind: Kind, config: Record<string, string>, secret: string): Promise<{ status: "connected" | "demo" | "error"; info: string }> {
  if (kind === "widget") return { status: "connected", info: "Sayt vidjeti: kodni saytingizga qo'ying" };
  const empty = !Object.values(config).some((v) => v?.trim());
  if (empty) return { status: "demo", info: "Demo kanal: xabarlar tashqariga chiqmaydi" };
  try {
    if (kind === "telegram") {
      const me = await post(`https://api.telegram.org/bot${config.token}/getMe`, {});
      if (!me.ok) return { status: "error", info: "Telegram token noto'g'ri" };
      const hook = await post(`https://api.telegram.org/bot${config.token}/setWebhook`, { url: hookUrl(cfg, { kind, secret }), allowed_updates: ["message"] });
      const u = (me.json.result ?? {}) as { username?: string };
      return hook.ok ? { status: "connected", info: `@${u.username}` } : { status: "error", info: `setWebhook: ${String(hook.json.description ?? hook.status)}` };
    }
    if (kind === "whatsapp") {
      if (!config.phoneNumberId || !config.token || !config.verifyToken) return { status: "error", info: "phoneNumberId, token va verifyToken kerak" };
      return { status: "connected", info: `Meta webhook: URL va verify token'ni Meta kabinetiga kiriting` };
    }
    if (kind === "instagram") {
      if (!config.pageId || !config.token) return { status: "error", info: "pageId va token kerak" };
      return { status: "connected", info: "Meta webhook: messages obunasini yoqing" };
    }
    if (kind === "sms") {
      if (!config.url) return { status: "error", info: "SMS shlyuz URL kerak" };
      return { status: "connected", info: `Jo'natuvchi: ${config.from || "standart"}` };
    }
  } catch (e) {
    return { status: "error", info: (e as Error).message };
  }
  return { status: "error", info: "noma'lum kanal" };
}

export async function send(ch: ChannelRow, to: { externalId: string | null; phone: string | null }, text: string): Promise<SendResult> {
  if (ch.kind === "widget") return { status: "sent" }; // the visitor's widget polls GET /api/widget/:key/messages
  if (isDemo(ch)) return { status: "demo" };
  const c = ch.config;
  try {
    if (ch.kind === "telegram") {
      const r = await post(`https://api.telegram.org/bot${c.token}/sendMessage`, { chat_id: to.externalId, text });
      return r.ok ? { status: "sent", externalId: String((r.json.result as { message_id?: number })?.message_id ?? "") } : { status: "failed", error: String(r.json.description ?? r.status) };
    }
    if (ch.kind === "whatsapp") {
      const r = await post(`${GRAPH}/${c.phoneNumberId}/messages`, { messaging_product: "whatsapp", to: to.externalId, type: "text", text: { body: text } }, { authorization: `Bearer ${c.token}` });
      return r.ok ? { status: "sent" } : { status: "failed", error: JSON.stringify(r.json.error ?? r.status).slice(0, 200) };
    }
    if (ch.kind === "instagram") {
      const r = await post(`${GRAPH}/${c.pageId}/messages`, { recipient: { id: to.externalId }, message: { text } }, { authorization: `Bearer ${c.token}` });
      return r.ok ? { status: "sent" } : { status: "failed", error: JSON.stringify(r.json.error ?? r.status).slice(0, 200) };
    }
    if (ch.kind === "sms") {
      const r = await post(c.url, { to: to.phone ?? to.externalId, text, from: c.from }, c.token ? { authorization: `Bearer ${c.token}` } : {});
      return r.ok ? { status: "sent" } : { status: "failed", error: `SMS ${r.status}` };
    }
  } catch (e) {
    return { status: "failed", error: (e as Error).message };
  }
  return { status: "failed", error: "noma'lum kanal" };
}

/** Webhook body → inbound messages (zero or more). Unknown shapes return []. */
export function parse(kind: Kind, body: unknown): Inbound[] {
  const b = (body ?? {}) as Record<string, any>;
  if (kind === "telegram") {
    const m = b.message;
    if (!m?.chat?.id || !(m.text || m.contact)) return [];
    const name = [m.from?.first_name, m.from?.last_name].filter(Boolean).join(" ") || m.from?.username || "Telegram mijoz";
    return [{ externalId: String(m.chat.id), name, username: m.from?.username, phone: m.contact?.phone_number, text: m.text ?? `📱 ${m.contact.phone_number}`, messageId: String(m.message_id) }];
  }
  if (kind === "whatsapp") {
    const out: Inbound[] = [];
    for (const e of b.entry ?? []) for (const ch of e.changes ?? []) {
      const v = ch.value ?? {};
      const names = new Map<string, string>((v.contacts ?? []).map((c: any) => [String(c.wa_id), String(c.profile?.name ?? "")]));
      for (const m of v.messages ?? []) if (m.type === "text") out.push({ externalId: String(m.from), name: names.get(String(m.from)) || "WhatsApp mijoz", phone: `+${m.from}`, text: String(m.text?.body ?? ""), messageId: m.id });
    }
    return out;
  }
  if (kind === "instagram") {
    const out: Inbound[] = [];
    for (const e of b.entry ?? []) for (const m of e.messaging ?? []) if (m.message?.text && !m.message.is_echo) out.push({ externalId: String(m.sender?.id), name: "Instagram mijoz", text: String(m.message.text), messageId: m.message.mid });
    return out;
  }
  if (kind === "sms") {
    if (!b.from || !b.text) return [];
    return [{ externalId: String(b.from), name: String(b.from), phone: String(b.from), text: String(b.text) }];
  }
  return [];
}
