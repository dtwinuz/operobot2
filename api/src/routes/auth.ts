// /api/auth/*, /api/me, /api/orgs/switch (docs/04 §Auth).
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Config } from "../config.js";
import { SYSTEM, tx } from "../db.js";
import { checkPassword, endSession, sha, hashPassword, me, requireAuth, startSession } from "../auth.js";
import { createOrg } from "../orgs.js";
import { createDemo } from "../demo.js";

const err = (code: number, m: string) => Object.assign(new Error(m), { statusCode: code });

export function authRoutes(app: FastifyInstance, cfg: Config): void {
  const secure = cfg.PUBLIC_URL.startsWith("https://");

  app.post("/api/auth/signup", { config: { rateLimit: { max: 10, timeWindow: "1 hour" } } }, async (req, reply) => {
    if (cfg.SIGNUP === "closed") throw err(403, "Ro'yxatdan o'tish yopiq");
    const b = z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().toLowerCase().email().max(120), password: z.string().min(8).max(200), company: z.string().trim().min(2).max(120) }).parse(req.body);
    const hash = await hashPassword(b.password);
    const ids = await tx(SYSTEM, async (q) => {
      if (await q.maybe("select 1 from users where email = $1", [b.email])) throw err(409, "Bu email bilan akkaunt bor");
      const u = await q.one<{ id: string }>("insert into users(email, name, password_hash) values ($1,$2,$3) returning id", [b.email, b.name, hash]);
      return { userId: u.id, orgId: await createOrg(q, b.company, u.id) };
    });
    await startSession(reply, ids.userId, ids.orgId, secure);
    return me(ids.userId, ids.orgId);
  });

  app.post("/api/auth/login", { config: { rateLimit: { max: 20, timeWindow: "15 minutes" } } }, async (req, reply) => {
    const b = z.object({ email: z.string().trim().toLowerCase(), password: z.string() }).parse(req.body);
    const u = await tx(SYSTEM, (q) => q.maybe<{ id: string; password_hash: string; demo: boolean; org: string | null }>(
      `select u.id, u.password_hash, u.demo, (select org_id from memberships m where m.user_id = u.id order by last_seen_at desc nulls last limit 1) org
       from users u where email = $1`, [b.email]));
    if (!u || u.demo || !u.org || !(await checkPassword(b.password, u.password_hash))) throw err(401, "Email yoki parol noto'g'ri");
    await startSession(reply, u.id, u.org, secure);
    return me(u.id, u.org);
  });

  app.post("/api/auth/demo", { config: { rateLimit: { max: 10, timeWindow: "1 hour" } } }, async (_req, reply) => {
    if (!cfg.DEMO) throw err(404, "Demo o'chirilgan");
    const ids = await createDemo();
    await startSession(reply, ids.userId, ids.orgId, secure);
    return me(ids.userId, ids.orgId);
  });

  app.post("/api/auth/logout", async (req, reply) => { await endSession(req, reply); return { ok: true }; });

  app.get("/api/me", { preHandler: requireAuth }, async (req) => me(req.ctx.userId, req.ctx.orgId));

  app.post("/api/orgs/switch", { preHandler: requireAuth }, async (req) => {
    const { orgId } = z.object({ orgId: z.string().uuid() }).parse(req.body);
    const ok = await tx(SYSTEM, async (q) => {
      if (!(await q.maybe("select 1 from memberships where org_id = $1 and user_id = $2", [orgId, req.ctx.userId]))) return false;
      await q.exec("update sessions set org_id = $1 where token_hash = $2", [orgId, sha(req.cookies.ob2_sid ?? "")]);
      return true;
    });
    if (!ok) throw err(403, "Bu tashkilotga a'zo emassiz");
    return me(req.ctx.userId, orgId);
  });
}
