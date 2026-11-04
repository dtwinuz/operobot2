// In-process event bus → SSE (GET /api/events). One API instance is enough for v0.1; for several instances
// this becomes Postgres LISTEN/NOTIFY (docs/02 §Kengayish).
import type { FastifyReply } from "fastify";

export type EventType = "message" | "conversation" | "lead" | "call" | "campaign" | "usage";

const subs = new Map<string, Set<FastifyReply>>();
const seen = new Map<string, number>(); // org → last time someone looked (simulator only runs for watched demo orgs)

export function subscribe(orgId: string, reply: FastifyReply): () => void {
  let set = subs.get(orgId);
  if (!set) subs.set(orgId, (set = new Set()));
  set.add(reply);
  touch(orgId);
  return () => {
    set!.delete(reply);
    if (!set!.size) subs.delete(orgId);
  };
}

export function emit(orgId: string, type: EventType, data: unknown): void {
  const set = subs.get(orgId);
  if (!set) return;
  const line = `data: ${JSON.stringify({ type, data })}\n\n`;
  for (const r of set) r.raw.write(line);
}

export function touch(orgId: string): void {
  seen.set(orgId, Date.now());
}

export function watched(orgId: string, withinMs = 20 * 60_000): boolean {
  return subs.has(orgId) || Date.now() - (seen.get(orgId) ?? 0) < withinMs;
}

setInterval(() => {
  for (const set of subs.values()) for (const r of set) r.raw.write(": ping\n\n");
}, 25_000).unref();
