// Routes without a session: channel webhooks, website widget, dialer results, Payme, MCP, health.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Config } from "../config.js";
import { ping, tx } from "../db.js";
import { parse, type Kind } from "../channels/adapters.js";
import { channelBySecret, channelByWidget, handleInbound } from "../flow.js";
import { finish, orgByDialerSecret } from "../voice/calls.js";
import { payme, paymeAuthOk } from "../billing/pay.js";
import { orgByApiKey } from "../auth.js";
import { mcp } from "../mcp.js";

export function publicRoutes(app: FastifyInstance, cfg: Config, version: string): void {
  app.get("/api/health", async () => ({ ok: true, db: await ping(), version }));

  // WhatsApp Cloud API verification handshake
  app.get("/api/hooks/whatsapp/:secret", async (req, reply) => {
    const { secret } = req.params as { secret: string };
    const qs = req.query as Record<string, string>;
    const ch = await channelBySecret("whatsapp", secret);
    if (!ch || qs["hub.mode"] !== "subscribe" || qs["hub.verify_token"] !== ch.config.verifyToken) return reply.code(403).send("forbidden");
    return reply.type("text/plain").send(qs["hub.challenge"] ?? "");
  });

  app.post("/api/hooks/:kind/:secret", { config: { rateLimit: { max: 600, timeWindow: "1 minute" } } }, async (req, reply) => {
    const { kind, secret } = req.params as { kind: string; secret: string };
    if (kind === "dialer") {
      const orgId = await orgByDialerSecret(secret);
      if (!orgId) return reply.code(404).send({ error: "topilmadi" });
      const b = z.object({ callId: z.string().uuid(), status: z.enum(["answered", "connected", "no_answer", "busy", "failed", "declined"]), durationSec: z.number().int().min(0).default(0), summary: z.string().max(1000).nullable().optional() }).parse(req.body);
      const ok = await tx(orgId, (q) => q.maybe("select 1 from calls where id = $1", [b.callId]));
      if (!ok) return reply.code(404).send({ error: "qo'ng'iroq topilmadi" });
      await finish(orgId, b.callId, b.status, b.durationSec, b.summary ?? null);
      return { ok: true };
    }
    if (!["telegram", "whatsapp", "instagram", "sms"].includes(kind)) return reply.code(404).send({ error: "topilmadi" });
    const ch = await channelBySecret(kind, secret);
    if (!ch) return reply.code(404).send({ error: "topilmadi" });
    for (const m of parse(kind as Kind, req.body)) await handleInbound(ch, m);
    return { ok: true };
  });

  // Website widget: the visitor id is a random string kept in the visitor's browser.
  // It runs on the customer's own site (another origin): open CORS for these two paths only, no cookies.
  app.addHook("onRequest", async (req, reply) => {
    if (!req.url.startsWith("/api/widget/")) return;
    reply.header("access-control-allow-origin", "*").header("access-control-allow-headers", "content-type").header("access-control-allow-methods", "GET, POST, OPTIONS").header("access-control-max-age", "86400");
    if (req.method === "OPTIONS") return reply.code(204).send();
  });
  const visitor = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);
  app.get("/api/widget/:key/messages", async (req, reply) => {
    const { key } = req.params as { key: string };
    const v = visitor.safeParse((req.query as Record<string, string>).visitor);
    const ch = await channelByWidget(key);
    if (!ch || !v.success) return reply.code(404).send({ error: "topilmadi" });
    const greeting = await tx(ch.org_id, (q) => q.maybe<{ greeting: string }>("select greeting from agents where kind = 'chat' and enabled order by created_at limit 1"));
    const rows = await tx(ch.org_id, (q) => q.many(
      `select m.id, m.direction, m.author, m.text, m.at from messages m join conversations c on c.id = m.conversation_id join contacts k on k.id = c.contact_id
       where c.channel_id = $1 and k.external_id = $2 and m.author <> 'system' order by m.at limit 200`, [ch.id, v.data]));
    return rows.length ? rows : [{ id: "greeting", direction: "out", author: "ai", text: greeting?.greeting || "Assalomu alaykum! Savolingizni yozing.", at: new Date().toISOString() }];
  });
  app.post("/api/widget/:key/messages", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req, reply) => {
    const { key } = req.params as { key: string };
    const body = z.object({ visitor: visitor.optional(), text: z.string().trim().min(1).max(2000), name: z.string().trim().max(80).optional(), page: z.string().max(500).optional() }).parse(req.body);
    const v = visitor.safeParse(body.visitor ?? (req.query as Record<string, string>).visitor);
    const ch = await channelByWidget(key);
    if (!ch || !v.success) return reply.code(404).send({ error: "topilmadi" });
    const convId = await handleInbound(ch, { externalId: v.data, name: body.name || "Sayt mehmoni", text: body.text });
    return tx(ch.org_id, (q) => q.maybe("select id, direction, author, text, at from messages where conversation_id = $1 and direction = 'in' order by at desc limit 1", [convId]));
  });

  app.post("/api/pay/payme", async (req, reply) => {
    if (!paymeAuthOk(cfg, req.headers.authorization)) return reply.send({ jsonrpc: "2.0", id: (req.body as { id?: unknown })?.id ?? null, error: { code: -32504, message: { uz: "Ruxsat yo'q", ru: "Net dostupa", en: "Unauthorized" } } });
    return payme(req.body as Record<string, any>);
  });

  app.post("/api/mcp", { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } }, async (req, reply) => {
    const orgId = await orgByApiKey(req.headers.authorization);
    if (!orgId) return reply.code(401).send({ error: "API kalit kerak: Authorization: Bearer ob2_..." });
    const out = await mcp(orgId, req.body as Record<string, any>);
    return out === null ? reply.code(202).send() : out;
  });
}
