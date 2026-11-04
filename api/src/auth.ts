// Passwords (scrypt), opaque session tokens (only sha256 stored) and the per-request tenant context.
import { createHash, randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { FastifyReply, FastifyRequest } from "fastify";
import { SYSTEM, tx, type Q } from "./db.js";
import { touch } from "./bus.js";

const scrypt = promisify(_scrypt) as (p: string, s: Buffer, n: number) => Promise<Buffer>;
export const COOKIE = "ob2_sid";
const DAYS = 30;

export type Role = "owner" | "admin" | "operator";
export interface Ctx { userId: string; userName: string; email: string; orgId: string; orgName: string; plan: string; demo: boolean; role: Role }

declare module "fastify" {
  interface FastifyRequest { ctx: Ctx; db: <T>(fn: (q: Q) => Promise<T>) => Promise<T> }
}

export async function hashPassword(p: string): Promise<string> {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("base64")}$${(await scrypt(p, salt, 32)).toString("base64")}`;
}

export async function checkPassword(p: string, stored: string): Promise<boolean> {
  const [kind, s, h] = stored.split("$");
  if (kind !== "scrypt" || !s || !h) return false;
  const want = Buffer.from(h, "base64");
  const got = await scrypt(p, Buffer.from(s, "base64"), want.length);
  return timingSafeEqual(want, got);
}

export const sha = (s: string) => createHash("sha256").update(s).digest("hex");
export const token = (bytes = 32) => randomBytes(bytes).toString("base64url");

export async function startSession(reply: FastifyReply, userId: string, orgId: string, secure: boolean): Promise<void> {
  const t = token();
  await tx(SYSTEM, (q) => q.exec("insert into sessions(token_hash, user_id, org_id, expires_at) values ($1, $2, $3, now() + $4::interval)", [sha(t), userId, orgId, `${DAYS} days`]));
  reply.setCookie(COOKIE, t, { path: "/", httpOnly: true, sameSite: "lax", secure, maxAge: DAYS * 86400 });
}

export async function endSession(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const t = req.cookies[COOKIE];
  if (t) await tx(SYSTEM, (q) => q.exec("delete from sessions where token_hash = $1", [sha(t)]));
  reply.clearCookie(COOKIE, { path: "/" });
}

async function load(t: string): Promise<Ctx | undefined> {
  return tx(SYSTEM, (q) => q.maybe<Ctx>(
    `select u.id "userId", u.name "userName", u.email, o.id "orgId", o.name "orgName", o.plan, o.demo, m.role
     from sessions s join users u on u.id = s.user_id join orgs o on o.id = s.org_id
     join memberships m on m.org_id = s.org_id and m.user_id = s.user_id
     where s.token_hash = $1 and s.expires_at > now()`, [sha(t)]));
}

/** preHandler for every session route: sets req.ctx and req.db (tenant-scoped transactions). */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const t = req.cookies[COOKIE];
  const ctx = t ? await load(t) : undefined;
  if (!ctx) { reply.code(401).send({ error: "Kirish kerak" }); return; }
  req.ctx = ctx;
  req.db = (fn) => tx(ctx.orgId, fn);
  touch(ctx.orgId);
}

export function requireRole(...roles: Role[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!roles.includes(req.ctx.role)) reply.code(403).send({ error: "Bu amal uchun huquq yo'q" });
  };
}

export async function me(userId: string, orgId: string) {
  return tx(SYSTEM, async (q) => {
    const user = await q.one<{ id: string; name: string; email: string }>("select id, name, email from users where id = $1", [userId]);
    const orgs = await q.many<{ id: string; name: string; role: Role; plan: string; demo: boolean }>(
      "select o.id, o.name, m.role, o.plan, o.demo from memberships m join orgs o on o.id = m.org_id where m.user_id = $1 order by o.created_at", [userId]);
    const cur = orgs.find((o) => o.id === orgId) ?? orgs[0];
    await q.exec("update memberships set last_seen_at = now() where org_id = $1 and user_id = $2", [cur.id, userId]);
    return {
      user, role: cur.role,
      org: { id: cur.id, name: cur.name, plan: cur.plan, demo: cur.demo },
      orgs: orgs.map((o) => ({ id: o.id, name: o.name, role: o.role })),
    };
  });
}

/** Org API key for MCP / external API: `ob2_<prefix>_<secret>`, only the hash is stored. */
export async function orgByApiKey(header: string | undefined): Promise<string | undefined> {
  const k = header?.replace(/^Bearer\s+/i, "").trim();
  if (!k) return undefined;
  const r = await tx(SYSTEM, (q) => q.maybe<{ id: string }>("select id from orgs where api_key_hash = $1", [sha(k)]));
  return r?.id;
}
